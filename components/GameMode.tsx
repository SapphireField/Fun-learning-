import React, { useState } from 'react';
import { Gamepad2, Star, RefreshCw, Trophy, Loader2, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { generateQuiz } from '../services/geminiService';
import { QuizQuestion } from '../types';

const TOPICS = ["Animals", "Colors", "Numbers", "Family", "Food", "Nature", "Greetings", "School"];

const GameMode: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [topic, setTopic] = useState("Animals");
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    const startGame = async (selectedTopic: string) => {
        setTopic(selectedTopic);
        setLoading(true);
        try {
            const data = await generateQuiz(selectedTopic);
            setQuestions(data);
            setCurrentIndex(0);
            setScore(0);
            setShowResult(false);
            setIsPlaying(true);
            setSelectedAnswer(null);
            setIsCorrect(null);
        } catch (e) {
            alert("Failed to start game. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (index: number) => {
        if (selectedAnswer !== null) return; // Prevent multiple clicks

        setSelectedAnswer(index);
        const correct = index === questions[currentIndex].correctAnswer;
        setIsCorrect(correct);
        if (correct) {
            setScore(score + 1);
        }
    };

    const nextQuestion = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setSelectedAnswer(null);
            setIsCorrect(null);
        } else {
            setShowResult(true);
        }
    };

    const quitGame = () => {
        setIsPlaying(false);
        setShowResult(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 bg-yellow-50">
                <Loader2 size={64} className="text-yellow-500 animate-spin mb-4" />
                <h2 className="text-2xl font-bold text-gray-700 animate-pulse">Building Quiz...</h2>
                <p className="text-gray-500">Teacher Panda is thinking of fun questions!</p>
            </div>
        );
    }

    if (showResult) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-yellow-50 text-center animate-in zoom-in">
                <div className="mb-6 relative">
                     <Trophy size={100} className="text-yellow-500" />
                     <div className="absolute top-0 right-0 animate-bounce">
                         <Star size={40} className="text-orange-400 fill-current" />
                     </div>
                </div>
                
                <h2 className="text-4xl font-black text-gray-800 mb-2 fun-font">Great Job!</h2>
                <p className="text-xl text-gray-600 mb-6">You scored {score} out of {questions.length}!</p>
                
                <div className="bg-white p-6 rounded-3xl shadow-lg border-4 border-yellow-200 w-full max-w-sm mb-8">
                     <div className="text-5xl font-black text-yellow-500 mb-2">{(score / questions.length) * 100}%</div>
                     <p className="text-gray-400 font-bold uppercase tracking-wider">Accuracy</p>
                </div>

                <div className="flex gap-4 w-full max-w-sm">
                    <button 
                        onClick={() => startGame(topic)}
                        className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-md hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center"
                    >
                        <RefreshCw className="mr-2" /> Play Again
                    </button>
                    <button 
                        onClick={quitGame}
                        className="flex-1 py-4 bg-white text-gray-600 border-2 border-gray-200 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95"
                    >
                        Menu
                    </button>
                </div>
            </div>
        );
    }

    if (isPlaying && questions.length > 0) {
        const currentQ = questions[currentIndex];
        
        return (
            <div className="flex flex-col h-full p-4 bg-yellow-50 max-w-md mx-auto relative overflow-hidden">
                <div className="flex justify-between items-center mb-6 z-10">
                     <button onClick={quitGame} className="text-gray-400 hover:text-gray-600 font-bold text-sm">Exit</button>
                     <div className="bg-white px-4 py-1 rounded-full shadow-sm text-sm font-bold text-yellow-600 border border-yellow-200">
                         {currentIndex + 1} / {questions.length}
                     </div>
                     <div className="flex items-center text-orange-500 font-bold">
                         <Star size={18} className="mr-1 fill-current" /> {score}
                     </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                    <div 
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                    ></div>
                </div>

                <div className="flex-1 flex flex-col justify-center z-10">
                    <div className="bg-white rounded-3xl p-6 shadow-xl border-b-8 border-r-4 border-yellow-200 mb-6 text-center">
                        <h3 className="text-2xl font-bold text-gray-800 mb-2 chinese-font">{currentQ.question}</h3>
                        {currentQ.pinyin && <p className="text-orange-500 font-medium mb-4">{currentQ.pinyin}</p>}
                    </div>

                    <div className="space-y-3">
                        {currentQ.options.map((option, idx) => {
                            let btnClass = "bg-white border-2 border-gray-100 text-gray-700 hover:border-yellow-300";
                            if (selectedAnswer !== null) {
                                if (idx === currentQ.correctAnswer) btnClass = "bg-green-100 border-green-500 text-green-700";
                                else if (idx === selectedAnswer) btnClass = "bg-red-100 border-red-500 text-red-700";
                                else btnClass = "bg-gray-50 border-gray-100 text-gray-400 opacity-60";
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(idx)}
                                    disabled={selectedAnswer !== null}
                                    className={`w-full p-4 rounded-xl font-bold text-lg shadow-sm transition-all flex justify-between items-center ${btnClass} ${selectedAnswer === null ? 'active:scale-95' : ''}`}
                                >
                                    <span>{option}</span>
                                    {selectedAnswer !== null && idx === currentQ.correctAnswer && <CheckCircle2 size={24} />}
                                    {selectedAnswer !== null && idx === selectedAnswer && idx !== currentQ.correctAnswer && <XCircle size={24} />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {selectedAnswer !== null && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 animate-in slide-in-from-bottom-10 z-20 rounded-t-3xl shadow-2xl">
                        <div className={`text-lg font-bold mb-2 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                            {isCorrect ? "Correct! 🎉" : "Oops! 😅"}
                        </div>
                        <p className="text-gray-600 text-sm mb-4">{currentQ.explanation}</p>
                        <button 
                            onClick={nextQuestion}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-md flex items-center justify-center ${isCorrect ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-800 hover:bg-gray-900'}`}
                        >
                            {currentIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"} <ArrowRight className="ml-2" size={20} />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Menu View
    return (
        <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto no-scrollbar pb-24 bg-yellow-50">
            <div className="mb-6 mt-2">
                <h2 className="text-3xl font-black text-gray-800 flex items-center fun-font">
                    <span className="bg-yellow-200 p-2 rounded-xl mr-3 text-yellow-600">🎮</span>
                    Game Mode
                </h2>
                <p className="text-gray-500 ml-16">Practice makes perfect!</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                {TOPICS.map((t) => (
                    <button 
                        key={t} 
                        onClick={() => startGame(t)}
                        className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-yellow-200 active:border-b-0 active:translate-y-1 transition-all hover:bg-yellow-50 text-center group"
                    >
                        <div className="font-bold text-gray-700 text-lg mb-1 group-hover:text-orange-500">{t}</div>
                        <div className="text-xs text-gray-400">Start Quiz</div>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-md border-2 border-orange-100 text-center">
                 <h3 className="font-bold text-gray-800 mb-2">Want a challenge?</h3>
                 <p className="text-gray-500 text-sm mb-4">Type any topic you want to learn!</p>
                 <input 
                    className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 mb-3 outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="e.g. Space, Dinosaurs..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            startGame((e.target as HTMLInputElement).value);
                        }
                    }}
                 />
            </div>
        </div>
    );
};

export default GameMode;