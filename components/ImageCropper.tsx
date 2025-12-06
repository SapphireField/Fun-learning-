import React, { useState, useRef, useEffect } from 'react';
import { Check, X, ZoomIn, ZoomOut, Move, RotateCcw } from 'lucide-react';

interface ImageCropperProps {
  file: File;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ file, onConfirm, onCancel }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePointerDown = (e: React.PointerEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handlePointerMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!isDragging) return;
    // Prevent scrolling on mobile while dragging
    if ('touches' in e) {
        // e.preventDefault(); // React synthetic events might not support this directly here
    }
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    setOffset({ x: clientX - dragStart.x, y: clientY - dragStart.y });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImageSize({ width: naturalWidth, height: naturalHeight });
    // Reset state
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleCrop = () => {
    if (!imgRef.current || !containerRef.current) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We crop based on what is visible in the container
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Set canvas to match container aspect ratio, but maybe higher resolution?
    // Let's stick to screen resolution for simplicity and speed
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    
    // Move to center
    ctx.translate(canvas.width / 2, canvas.height / 2);
    // Apply transformations (match the CSS)
    ctx.scale(zoom, zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom); // Logic: visual offset is applied after scale in CSS usually? 
    // Wait, in our CSS: transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
    // Translate happens first (coordinate system moves), then scale happens at the new origin?
    // Standard CSS transform order is right-to-left for matrix multiplication, but textually left-to-right application.
    // translate(x,y) scale(z) -> Translate, then Scale.
    
    // In Canvas:
    // ctx.translate(offset.x, offset.y);
    // ctx.scale(zoom, zoom);
    
    // But we centered the context first.
    // The CSS logic puts the image center at the container center initially (if absolute centered).
    // Let's assume the image is centered.
    
    // Canvas Logic mirroring the Visuals:
    // 1. We start at center of canvas.
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    
    // Draw image such that its center is at the current context origin
    // We use the rendered width/height of the image to ensure aspect ratio is correct
    // But we need the natural aspect ratio.
    
    // We need to figure out the rendered size of the image before scale
    // If we use object-fit: contain logic in CSS, we need to replicate.
    // Simpler: Just render the natural image centered.
    // But in the div, the image might be huge.
    // Let's assume the user adjusts the image to fit how they want.
    
    // To match exactly:
    // We draw the natural image centered.
    const renderWidth = imgRef.current.naturalWidth;
    const renderHeight = imgRef.current.naturalHeight;
    
    // However, if the natural image is 4000px wide, and zoom is 1, it will be huge on a 300px canvas.
    // We need to scale the natural image down to "fit" initial state like CSS object-fit usually does, 
    // OR we just rely on the user zooming out.
    // Let's pre-scale the image to 'contain' within the canvas, then apply user zoom.
    
    const scaleFactor = Math.min(canvas.width / renderWidth, canvas.height / renderHeight);
    
    // Effective scale = Base Fit Scale * User Zoom
    // But our CSS transform applies User Zoom directly to the element.
    // So if the element is an <img> tag without width/height constraints, it renders full size.
    // If we want WYSIWYG, we need to match the DOM exactly.
    
    // In the render below, <img src={src} /> has no explicit size, so it's natural size.
    // BUT we usually want it to start fitted.
    // Let's constrain the img in CSS to `max-width: 100%; max-height: 100%`?
    // If we do that, the dimensions change.
    
    // BETTER APPROACH: Use the visual size of the img element.
    const imgRect = imgRef.current.getBoundingClientRect();
    // Calculate current visual scale relative to natural
    const currentVisualWidth = imgRect.width; // This includes the zoom transform
    const currentVisualHeight = imgRect.height;
    
    // We want to draw exactly what's visible relative to the container center.
    // Container center is (canvas.width/2, canvas.height/2).
    // Image center is currently at: 
    // ContainerCenter + Offset
    
    // So we draw the image centered at (0,0) in the transformed context.
    // The size should be the Natural Size.
    // But we need to scale the context so Natural Size matches Visual Size.
    // Visual Size = Natural Size * CSS_Scale * Base_CSS_Constraint_Scale?
    
    // Let's simplify: 
    // We draw the image at its natural size, scaled by `zoom` * `initialFitScale`.
    const fitScale = Math.min(containerRect.width / renderWidth, containerRect.height / renderHeight);
    
    // We apply the fitScale in the canvas context too
    ctx.scale(fitScale, fitScale);
    
    ctx.drawImage(imgRef.current, -renderWidth / 2, -renderHeight / 2);
    
    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        // Convert to File
        const newFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
        onConfirm(newFile);
      } else {
        onCancel();
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in fade-in h-full w-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-black/50 backdrop-blur-sm z-10">
         <button onClick={onCancel} className="text-white p-2 rounded-full hover:bg-white/20">
            <X size={24} />
         </button>
         <h3 className="text-white font-bold">Adjust Image</h3>
         <button onClick={handleCrop} className="text-orange-400 p-2 rounded-full hover:bg-white/20 font-bold flex items-center">
            <Check size={24} className="mr-1"/> Done
         </button>
      </div>

      {/* Main Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-black touch-none flex items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handlePointerDown as any} // Cast for TS compatibility if needed
        onTouchMove={handlePointerMove as any}
        onTouchEnd={handlePointerUp}
      >
         {imageSrc && (
             <img 
                ref={imgRef}
                src={imageSrc} 
                alt="Crop target" 
                onLoad={handleImageLoad}
                draggable={false}
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    pointerEvents: 'none', // Let container handle events
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
             />
         )}
         
         {/* Overlay Grid Guide */}
         <div className="absolute inset-0 pointer-events-none border-2 border-white/30">
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20"></div>
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20"></div>
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20"></div>
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20"></div>
         </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-black/80 p-6 pb-8 flex flex-col gap-4">
         <div className="flex items-center gap-4 text-white">
            <ZoomOut size={20} className="text-gray-400" />
            <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.1" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <ZoomIn size={20} className="text-gray-400" />
         </div>
         <p className="text-center text-xs text-gray-500">Drag to Pan • Pinch or Slide to Zoom</p>
      </div>
    </div>
  );
};

export default ImageCropper;