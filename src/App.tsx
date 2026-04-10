/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Play, 
  Square, 
  RotateCcw, 
  Trophy, 
  AlertCircle,
  Clock,
  Activity,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { audioService } from './services/audio';
import { cn } from '@/lib/utils';

// --- Types ---

type GameState = 'idle' | 'running' | 'finished';
type VisualMode = 'pills' | 'circles' | 'bar';
type TimeDisplayMode = 'all' | 'progress-only' | 'none';

interface SessionStats {
  checkpoints: number;
  taps: number;
  missed: number;
  perfect: number;
  good: number;
  niceTry: number;
  totalError: number;
  earlyCount: number;
  lateCount: number;
}

interface Feedback {
  type: 'perfect' | 'good' | 'niceTry' | 'missing';
  diff: number;
  timestamp: number;
}

// --- Constants ---

const MAX_ERROR_MS = 300;

export default function App() {
  // --- Settings State ---
  const [duration, setDuration] = useState(2); // minutes
  const [bpm, setBpm] = useState(60); // checkpoints per minute
  const [greenThreshold, setGreenThreshold] = useState(50); // ms
  const [orangeThreshold, setOrangeThreshold] = useState(150); // ms
  const [visualMode, setVisualMode] = useState<VisualMode>('pills');
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplayMode>('all');
  const [showSettings, setShowSettings] = useState(false);

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>('idle');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [lastCheckpointIdx, setLastCheckpointIdx] = useState(-1);
  const [stats, setStats] = useState<SessionStats>({
    checkpoints: 0,
    taps: 0,
    missed: 0,
    perfect: 0,
    good: 0,
    niceTry: 0,
    totalError: 0,
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // --- Refs for precision ---
  const requestRef = useRef<number>(null);
  const statsRef = useRef(stats);
  const lastProcessedCheckpointRef = useRef(-1);
  const tapsInCurrentCheckpointRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // --- Logic ---

  const checkpointInterval = (60 / bpm) * 1000;
  const totalDurationMs = duration * 60 * 1000;

  const startSession = () => {
    setGameState('running');
    setStartTime(performance.now());
    setCurrentTime(0);
    setLastCheckpointIdx(-1);
    lastProcessedCheckpointRef.current = -1;
    tapsInCurrentCheckpointRef.current = new Set();
    setStats({
      checkpoints: 0,
      taps: 0,
      missed: 0,
      perfect: 0,
      good: 0,
      niceTry: 0,
      totalError: 0,
      earlyCount: 0,
      lateCount: 0,
    });
    setFeedback(null);
  };

  const stopSession = useCallback(() => {
    setGameState('finished');
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, []);

  const handleTap = useCallback(() => {
    if (gameState !== 'running' || !startTime) return;

    const now = performance.now();
    const elapsed = now - startTime;
    
    // Find nearest checkpoint
    const nearestIdx = Math.round(elapsed / checkpointInterval);
    const checkpointTime = nearestIdx * checkpointInterval;
    const diff = elapsed - checkpointTime;
    const absDiff = Math.abs(diff);

    // Only process if within 300ms of a checkpoint and not already tapped for this one
    if (absDiff < MAX_ERROR_MS && !tapsInCurrentCheckpointRef.current.has(nearestIdx)) {
      tapsInCurrentCheckpointRef.current.add(nearestIdx);
      
      let type: Feedback['type'] = 'missing';
      if (absDiff <= greenThreshold) {
        type = 'perfect';
        audioService.playA();
      } else if (absDiff <= orangeThreshold) {
        type = 'good';
        audioService.playC();
      } else {
        type = 'niceTry';
        audioService.playD();
      }

      setStats(prev => ({
        ...prev,
        taps: prev.taps + 1,
        [type]: prev[type] + 1,
        totalError: prev.totalError + absDiff,
        earlyCount: type !== 'perfect' && diff < 0 ? prev.earlyCount + 1 : prev.earlyCount,
        lateCount: type !== 'perfect' && diff >= 0 ? prev.lateCount + 1 : prev.lateCount,
      }));

      setFeedback({
        type,
        diff: Math.round(diff),
        timestamp: now
      });
    }
  }, [gameState, startTime, checkpointInterval, greenThreshold, orangeThreshold]);

  // Game Loop
  const animate = useCallback((time: number) => {
    if (gameState !== 'running' || !startTime) return;

    const elapsed = time - startTime;
    setCurrentTime(elapsed);

    if (elapsed >= totalDurationMs) {
      stopSession();
      return;
    }

    const currentCheckpointIdx = Math.floor(elapsed / checkpointInterval);
    
    // Play sound B at each checkpoint
    if (currentCheckpointIdx > lastProcessedCheckpointRef.current) {
      audioService.playB();
      lastProcessedCheckpointRef.current = currentCheckpointIdx;
      setStats(prev => ({ ...prev, checkpoints: prev.checkpoints + 1 }));

      // Check for missed previous checkpoint
      if (currentCheckpointIdx > 0) {
        const prevIdx = currentCheckpointIdx - 1;
        if (!tapsInCurrentCheckpointRef.current.has(prevIdx)) {
          setStats(prev => ({ ...prev, missed: prev.missed + 1 }));
        }
      }
    }

    // Clear feedback after 300ms
    setFeedback(prev => {
      if (prev && time - prev.timestamp > 300) return null;
      return prev;
    });

    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, startTime, totalDurationMs, checkpointInterval, stopSession]);

  useEffect(() => {
    if (gameState === 'running') {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, animate]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  // --- Render Helpers ---

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor((totalDurationMs - ms) / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / totalDurationMs) * 100;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-orange-200">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-[#141414]/10 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center text-white">
            <Activity className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase">Rhythm Trainer</h1>
        </div>
        
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogTrigger render={<Button variant="outline" size="icon" className="rounded-full border-[#141414]/20" />}>
            <Settings className="w-5 h-5" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold uppercase tracking-tight">Session Settings</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Duration (min)</Label>
                  <span className="text-sm font-mono font-bold">{duration}m</span>
                </div>
                <Slider 
                  value={[duration]} 
                  onValueChange={(v) => setDuration(Array.isArray(v) ? v[0] : v)} 
                  max={10} 
                  min={1} 
                  step={1} 
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Checkpoints / min (BPM)</Label>
                  <span className="text-sm font-mono font-bold">{bpm}</span>
                </div>
                <Slider 
                  value={[bpm]} 
                  onValueChange={(v) => setBpm(Array.isArray(v) ? v[0] : v)} 
                  max={200} 
                  min={20} 
                  step={1} 
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Green Zone (ms)</Label>
                  <span className="text-sm font-mono font-bold">±{greenThreshold}ms</span>
                </div>
                <Slider 
                  value={[greenThreshold]} 
                  onValueChange={(v) => setGreenThreshold(Array.isArray(v) ? v[0] : v)} 
                  max={150} 
                  min={10} 
                  step={5} 
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Orange Zone (ms)</Label>
                  <span className="text-sm font-mono font-bold">±{orangeThreshold}ms</span>
                </div>
                <Slider 
                  value={[orangeThreshold]} 
                  onValueChange={(v) => setOrangeThreshold(Array.isArray(v) ? v[0] : v)} 
                  max={250} 
                  min={60} 
                  step={5} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Visual Mode</Label>
                  <Tabs value={visualMode} onValueChange={(v) => setVisualMode(v as VisualMode)}>
                    <TabsList className="grid grid-cols-3 w-full">
                      <TabsTrigger value="pills">Pills</TabsTrigger>
                      <TabsTrigger value="circles">Circle</TabsTrigger>
                      <TabsTrigger value="bar">Bar</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Time Display</Label>
                  <Tabs value={timeDisplay} onValueChange={(v) => setTimeDisplay(v as TimeDisplayMode)}>
                    <TabsList className="grid grid-cols-3 w-full">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="progress-only">Bar</TabsTrigger>
                      <TabsTrigger value="none">Off</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSettings(false)} className="w-full rounded-xl bg-[#141414] hover:bg-[#141414]/90">Save Configuration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="max-w-xl mx-auto p-6 space-y-8">
        {/* Progress Section */}
        {timeDisplay !== 'none' && (
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Time Remaining</span>
                {timeDisplay === 'all' && (
                  <div className="text-4xl font-mono font-bold tabular-nums">
                    {formatTime(currentTime)}
                  </div>
                )}
              </div>
              <div className="text-right space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Progress</span>
                <div className="text-sm font-mono font-bold">{Math.floor(progress)}%</div>
              </div>
            </div>
            <div className="h-2 w-full bg-[#141414]/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-[#141414]" 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        )}

        {/* Visual Feedback Area */}
        <div className="relative aspect-video bg-white rounded-[40px] border border-[#141414]/5 shadow-2xl shadow-[#141414]/5 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            {gameState === 'idle' ? (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="text-center space-y-4"
              >
                <div className="w-20 h-20 bg-[#141414]/5 rounded-full flex items-center justify-center mx-auto">
                  <Play className="w-8 h-8 fill-[#141414]" />
                </div>
                <p className="text-sm font-medium opacity-40 uppercase tracking-widest">Ready to start?</p>
              </motion.div>
            ) : gameState === 'running' ? (
              <div className="w-full h-full flex items-center justify-center">
                {visualMode === 'pills' && (
                  <div className="flex items-center gap-1.5 sm:gap-3 h-32">
                    {/* Red Left */}
                    <div className={cn(
                      "w-8 sm:w-12 h-16 sm:h-24 rounded-full transition-all duration-150 border-2 sm:border-4 flex items-center justify-center",
                      feedback?.type === 'niceTry' && feedback.diff < 0 ? "bg-red-100 border-red-500 scale-110 shadow-lg shadow-red-200" : "bg-red-50 border-transparent opacity-20"
                    )}>
                      {feedback?.type === 'niceTry' && feedback.diff < 0 && (
                        <span className="text-red-700 font-mono font-bold text-xs sm:text-base">{feedback.diff}</span>
                      )}
                    </div>
                    {/* Orange Left */}
                    <div className={cn(
                      "w-10 sm:w-16 h-20 sm:h-28 rounded-full transition-all duration-150 border-2 sm:border-4 flex items-center justify-center",
                      feedback?.type === 'good' && feedback.diff < 0 ? "bg-orange-100 border-orange-500 scale-110 shadow-lg shadow-orange-200" : "bg-orange-50 border-transparent opacity-20"
                    )}>
                      {feedback?.type === 'good' && feedback.diff < 0 && (
                        <span className="text-orange-700 font-mono font-bold text-xs sm:text-base">{feedback.diff}</span>
                      )}
                    </div>
                    {/* Green Center */}
                    <div className={cn(
                      "w-16 sm:w-24 h-24 sm:h-32 rounded-full transition-all duration-150 border-2 sm:border-4 flex flex-col items-center justify-center",
                      feedback?.type === 'perfect' ? "bg-green-100 border-green-500 scale-110 shadow-lg shadow-green-200" : "bg-green-50 border-transparent opacity-20"
                    )}>
                      {feedback?.type === 'perfect' && (
                        <span className="text-green-700 font-mono font-bold text-sm sm:text-lg">
                          {feedback.diff > 0 ? `+${feedback.diff}` : feedback.diff}
                        </span>
                      )}
                    </div>
                    {/* Orange Right */}
                    <div className={cn(
                      "w-10 sm:w-16 h-20 sm:h-28 rounded-full transition-all duration-150 border-2 sm:border-4 flex items-center justify-center",
                      feedback?.type === 'good' && feedback.diff >= 0 ? "bg-orange-100 border-orange-500 scale-110 shadow-lg shadow-orange-200" : "bg-orange-50 border-transparent opacity-20"
                    )}>
                      {feedback?.type === 'good' && feedback.diff >= 0 && (
                        <span className="text-orange-700 font-mono font-bold text-xs sm:text-base">+{feedback.diff}</span>
                      )}
                    </div>
                    {/* Red Right */}
                    <div className={cn(
                      "w-8 sm:w-12 h-16 sm:h-24 rounded-full transition-all duration-150 border-2 sm:border-4 flex items-center justify-center",
                      feedback?.type === 'niceTry' && feedback.diff >= 0 ? "bg-red-100 border-red-500 scale-110 shadow-lg shadow-red-200" : "bg-red-50 border-transparent opacity-20"
                    )}>
                       {feedback?.type === 'niceTry' && feedback.diff >= 0 && (
                        <span className="text-red-700 font-mono font-bold text-xs sm:text-base">+{feedback.diff}</span>
                      )}
                    </div>
                  </div>
                )}

                {visualMode === 'circles' && (
                  <div className="relative w-64 h-64 flex items-center justify-center">
                    {/* Reference Circle (Target) */}
                    <div className="absolute w-24 h-24 border-4 border-[#141414]/20 rounded-full" />
                    
                    {/* Continuous Shrinking Indicator */}
                    {(() => {
                      const cycleTime = currentTime % checkpointInterval;
                      
                      // Calculate signed difference from nearest beat (-interval/2 to +interval/2)
                      const diff = cycleTime > checkpointInterval / 2 
                        ? cycleTime - checkpointInterval 
                        : cycleTime;
                      
                      // Size logic: 
                      // At diff = 0 (beat), size = 96 (exact overlap)
                      // At diff = -checkpointInterval/2 (early), size = 96 + 96
                      // At diff = +checkpointInterval/2 (late), size = 96 - 96
                      const half_checkpointInterval = checkpointInterval/2;
                      const size = 96 - (diff/half_checkpointInterval) * 96;
                      
                      // Opacity: Peak at the beat (diff = 0)
                      const opacity = Math.max(0, 1 - Math.abs(diff / (checkpointInterval / 2)));

                      return (
                        <div 
                          className="absolute border-4 border-[#141414] rounded-full"
                          style={{ 
                            width: Math.max(0, size), 
                            height: Math.max(0, size),
                            opacity: opacity
                          }}
                        />
                      );
                    })()}

                    {/* Feedback Circle */}
                    <AnimatePresence>
                      {feedback && (
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 1.2, opacity: 0 }}
                          className={cn(
                            "absolute w-24 h-24 rounded-full border-4 flex items-center justify-center",
                            feedback.type === 'perfect' ? "bg-green-100 border-green-500" :
                            feedback.type === 'good' ? "bg-orange-100 border-orange-500" :
                            "bg-red-100 border-red-500"
                          )}
                        >
                          <span className={cn(
                            "font-mono font-bold text-xl",
                            feedback.type === 'perfect' ? "text-green-700" :
                            feedback.type === 'good' ? "text-orange-700" :
                            "text-red-700"
                          )}>
                            {feedback.diff > 0 ? `+${feedback.diff}` : feedback.diff}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {visualMode === 'bar' && (
                  <div className="w-full px-12 space-y-8">
                    <div className="relative h-1 bg-[#141414]/10 rounded-full">
                      {/* Center Mark (Target) */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-8 bg-[#141414]/40 rounded-full" />
                      
                      {/* Moving Indicator */}
                      {(() => {
                        const cycleTime = currentTime % checkpointInterval;
                        // Offset by half interval so checkpoint is at 50%
                        const pos = ((cycleTime + checkpointInterval / 2) % checkpointInterval) / checkpointInterval * 100;
                        return (
                          <motion.div 
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#141414] rounded-full shadow-lg z-10"
                            style={{ left: `${pos}%`, marginLeft: '-8px' }}
                          />
                        );
                      })()}
                    </div>
                    
                    {/* Feedback Text */}
                    <div className="h-12 flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        {feedback && (
                          <motion.div
                            key={feedback.timestamp}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            className={cn(
                              "text-2xl font-bold uppercase tracking-tighter",
                              feedback.type === 'perfect' ? "text-green-600" :
                              feedback.type === 'good' ? "text-orange-600" :
                              "text-red-600"
                            )}
                          >
                            {feedback.type === 'perfect' ? 'Perfect' : 
                             feedback.type === 'good' ? 'Good' : 
                             feedback.diff < 0 ? 'Early' : 'Late'}
                            <span className="ml-2 font-mono text-sm opacity-60">
                              ({feedback.diff > 0 ? `+${feedback.diff}` : feedback.diff}ms)
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <motion.div 
                key="finished"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-6 p-8"
              >
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-600">
                  <Trophy className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold uppercase tracking-tight">Session Complete</h2>
                  <p className="text-sm opacity-40">Great work on your timing practice.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#141414]/5 rounded-2xl text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Accuracy</span>
                    <div className="text-xl font-mono font-bold">
                      {stats.checkpoints > 0 ? Math.round((stats.perfect / stats.checkpoints) * 100) : 0}%
                    </div>
                  </div>
                  <div className="p-4 bg-[#141414]/5 rounded-2xl text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Avg Error</span>
                    <div className="text-xl font-mono font-bold">
                      {stats.taps > 0 ? Math.round(stats.totalError / stats.taps) : 0}ms
                    </div>
                  </div>
                </div>
                <Button onClick={startSession} className="w-full rounded-2xl h-14 text-lg font-bold uppercase tracking-widest">
                  <RotateCcw className="w-5 h-5 mr-2" /> Restart
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Interaction Area */}
        <div className="grid grid-cols-1 gap-4">
          <Button 
            disabled={gameState !== 'running'}
            onPointerDown={(e) => {
              e.preventDefault();
              handleTap();
            }}
            className={cn(
              "h-32 rounded-[40px] text-2xl font-bold uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl select-none touch-none",
              gameState === 'running' 
                ? "bg-[#141414] hover:bg-[#141414]/90 shadow-[#141414]/20" 
                : "bg-[#141414]/5 text-[#141414]/20 shadow-none cursor-not-allowed"
            )}
          >
            Tap Here
          </Button>
          
          <div className="flex gap-4">
            {gameState === 'idle' ? (
              <Button onClick={startSession} className="flex-1 h-16 rounded-3xl bg-green-600 hover:bg-green-700 text-white font-bold uppercase tracking-widest">
                <Play className="w-5 h-5 mr-2 fill-white" /> Start Session
              </Button>
            ) : (
              <Button onClick={stopSession} variant="outline" className="flex-1 h-16 rounded-3xl border-[#141414]/10 hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-bold uppercase tracking-widest">
                <Square className="w-5 h-5 mr-2 fill-current" /> Stop Session
              </Button>
            )}
          </div>
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Checkpoints</span>
            <div className="text-2xl font-mono font-bold">{stats.checkpoints}</div>
          </div>
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Taps</span>
            <div className="text-2xl font-mono font-bold">{stats.taps}</div>
          </div>
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-red-500">Missed</span>
            <div className="text-2xl font-mono font-bold text-red-500">{stats.missed}</div>
          </div>
        </div>
      </main>

      {/* Summary Dialog */}
      <Dialog open={gameState === 'finished'} onOpenChange={(open) => !open && setGameState('idle')}>
        <DialogContent className="sm:max-w-[500px] rounded-[40px] p-8">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold uppercase tracking-tighter text-center">Session Summary</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8 py-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Total Checkpoints</Label>
                <div className="text-3xl font-mono font-bold">{stats.checkpoints}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Average Error</Label>
                <div className="text-3xl font-mono font-bold">{stats.taps > 0 ? Math.round(stats.totalError / stats.taps) : 0}ms</div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Performance Breakdown</Label>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-green-50 p-3 rounded-2xl border border-green-100 text-center">
                  <div className="text-xs font-bold text-green-700 uppercase mb-1">Perfect</div>
                  <div className="text-xl font-mono font-bold text-green-900">{stats.perfect}</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100 text-center">
                  <div className="text-xs font-bold text-orange-700 uppercase mb-1">Good</div>
                  <div className="text-xl font-mono font-bold text-orange-900">{stats.good}</div>
                </div>
                <div className="bg-red-50 p-3 rounded-2xl border border-red-100 text-center">
                  <div className="text-xs font-bold text-red-700 uppercase mb-1">Off</div>
                  <div className="text-xl font-mono font-bold text-red-900">{stats.niceTry}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1">Missed</div>
                  <div className="text-xl font-mono font-bold text-gray-900">{stats.missed}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-60">
                <span>Accuracy Score</span>
                <span>{stats.checkpoints > 0 ? Math.round((stats.perfect / stats.checkpoints) * 100) : 0}%</span>
              </div>
              <Progress value={stats.checkpoints > 0 ? (stats.perfect / stats.checkpoints) * 100 : 0} className="h-3 rounded-full" />
            </div>

            {/* Timing Tendency */}
            {(stats.earlyCount + stats.lateCount) > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Timing Tendency</Label>
                  <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-orange-600">Early {Math.round((stats.earlyCount / (stats.earlyCount + stats.lateCount)) * 100)}%</span>
                    <span className="text-blue-600">Late {Math.round((stats.lateCount / (stats.earlyCount + stats.lateCount)) * 100)}%</span>
                  </div>
                </div>
                <div className="h-4 w-full bg-[#141414]/5 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-orange-400 transition-all duration-500" 
                    style={{ width: `${(stats.earlyCount / (stats.earlyCount + stats.lateCount)) * 100}%` }}
                  />
                  <div 
                    className="h-full bg-blue-400 transition-all duration-500" 
                    style={{ width: `${(stats.lateCount / (stats.earlyCount + stats.lateCount)) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-center opacity-40 italic">
                  (Excluding {stats.perfect} perfect taps)
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setGameState('idle')} className="w-full h-14 rounded-2xl text-lg font-bold uppercase tracking-widest">
              Close Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
