let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

function getAudioContext() {
  if (!audioContext) {
    // Initialize AudioContext with 24kHz sample rate as used by Gemini TTS
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function stopAudio() {
  if (currentSource) {
    try {
      currentSource.stop();
      currentSource.disconnect();
    } catch (e) {
      // Ignore errors if already stopped
    }
    currentSource = null;
  }
}

export async function playPCM(base64Data: string, onStart?: (duration: number) => void): Promise<void> {
  // Stop any currently playing audio before starting new one
  stopAudio();

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const pcmData = decodeBase64(base64Data);
    
    // The Gemini API returns raw PCM 16-bit little-endian audio.
    const int16Data = new Int16Array(pcmData.buffer);
    const float32Data = new Float32Array(int16Data.length);
    
    for (let i = 0; i < int16Data.length; i++) {
      // Normalize to [-1.0, 1.0]
      float32Data[i] = int16Data[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    currentSource = source;

    if (onStart) {
        onStart(buffer.duration);
    }

    return new Promise((resolve) => {
      source.onended = () => {
        if (currentSource === source) {
          currentSource = null;
        }
        resolve();
      };
      source.start();
    });

  } catch (e) {
    console.error("Error playing audio:", e);
    currentSource = null;
  }
}

// Calculate the active index based on audio progress, accounting for punctuation pauses
export function calculateWeightedActiveIndex(progress: number, items: { char: string }[]): number {
  if (!items || items.length === 0) return -1;
  
  // START BUFFER: Force index 0 for the first 3% of playback to account for initial TTS silence/breath
  if (progress < 0.03) return 0;
  
  if (progress >= 1) return items.length - 1;

  // Heuristic weights for TTS timing
  const weights = items.map(item => {
    const c = item.char;
    // Long pauses for sentence endings - Increased weight for better sync
    if (['。', '！', '!', '？', '?', '…', '：', ':'].includes(c)) return 5.0;
    // Medium pauses for clause breaks - Increased weight
    if (['，', ',', '、', '；', ';'].includes(c)) return 3.0;
    // Slight pause for whitespace/newlines
    if (!c.trim()) return 0.5; 
    // Default weight for a character
    return 1.0;
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  // Adjust progress to account for the buffer we skipped
  const effectiveProgress = (progress - 0.03) / 0.97;
  // Clamp to 0
  const adjustedProgress = Math.max(0, effectiveProgress);
  
  const targetWeight = adjustedProgress * totalWeight;

  let currentWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    currentWeight += weights[i];
    // If the accumulated weight passes the target, we are currently "in" this item's time slice
    if (currentWeight >= targetWeight) {
      return i;
    }
  }

  return items.length - 1;
}

// For English words which vary in length
export function calculateWeightedActiveIndexForTokens(progress: number, tokens: { text: string }[]): number {
    if (!tokens || tokens.length === 0) return -1;
    
    // START BUFFER
    if (progress < 0.03) return 0;
    if (progress >= 1) return tokens.length - 1;

    const weights = tokens.map(t => {
        const word = t.text;
        // Base weight on length (approx 1 unit per 3-4 chars, min 1)
        let w = Math.max(1, word.length / 3.5);
        
        // Add weight for punctuation
        if (word.includes('.') || word.includes('!') || word.includes('?')) w += 4.0;
        else if (word.includes(',') || word.includes(';')) w += 2.0;
        
        return w;
    });

    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    const effectiveProgress = (progress - 0.03) / 0.97;
    const adjustedProgress = Math.max(0, effectiveProgress);
    const targetWeight = adjustedProgress * totalWeight;

    let currentWeight = 0;
    for (let i = 0; i < weights.length; i++) {
        currentWeight += weights[i];
        if (currentWeight >= targetWeight) return i;
    }
    return tokens.length - 1;
}
