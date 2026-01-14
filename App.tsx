
import React, { useState, useEffect, useRef } from 'react';
import { Thought, AppView } from './types';
import { analyzeThought, getReflectionPrompt } from './services/geminiService';
import { PlusIcon, CalendarIcon, ListIcon, CameraIcon, BrainIcon, MicIcon, MicOffIcon } from './components/Icons';

const App: React.FC = () => {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [view, setView] = useState<AppView>(AppView.TIMELINE);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [newThoughtText, setNewThoughtText] = useState('');
  const [newThoughtImages, setNewThoughtImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dailyPrompt, setDailyPrompt] = useState('What are you thinking about right now?');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setNewThoughtText(prev => prev.endsWith(' ') || prev === '' ? prev + transcript : prev + ' ' + transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('thought_stream_v1');
    if (saved) {
      try {
        const parsed = (JSON.parse(saved) as any[]).map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp)
        })) as Thought[];
        setThoughts(parsed);
      } catch (e) {
        console.error("Failed to parse saved thoughts", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('thought_stream_v1', JSON.stringify(thoughts));
    
    if (thoughts.length > 0) {
      const updatePrompt = async () => {
        const recent = thoughts.slice(0, 3).map(t => t.content);
        const p = await getReflectionPrompt(recent);
        setDailyPrompt(p);
      };
      updatePrompt();
    }
  }, [thoughts]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewThoughtImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleAddThought = async () => {
    if (!newThoughtText.trim() && newThoughtImages.length === 0) return;

    if (isRecording) {
      recognitionRef.current?.stop();
    }

    setIsAnalyzing(true);
    const tempId = Date.now().toString();
    const newThought: Thought = {
      id: tempId,
      content: newThoughtText,
      timestamp: new Date(),
      images: newThoughtImages,
    };

    try {
      const { analysis, questions } = await analyzeThought(newThoughtText, newThoughtImages);
      newThought.analysis = analysis;
      newThought.aiQuestions = questions;
    } catch (error) {
      console.error("AI Analysis failed", error);
    }

    setThoughts(prev => [newThought, ...prev]);
    setNewThoughtText('');
    setNewThoughtImages([]);
    setIsInputOpen(false);
    setIsAnalyzing(false);
  };

  const deleteThought = (id: string) => {
    setThoughts(prev => prev.filter(t => t.id !== id));
  };

  const groupedThoughts = thoughts.reduce((acc, thought) => {
    const dateStr = thought.timestamp.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(thought);
    return acc;
  }, {} as Record<string, Thought[]>);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 relative overflow-hidden antialiased">
      {/* Header */}
      <header className="px-6 pt-14 pb-4 bg-white/70 ios-blur sticky top-0 z-20 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stream</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">
              {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button 
            onClick={() => setIsInputOpen(true)}
            className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-100 active:scale-95 transition-all"
          >
            <PlusIcon />
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto px-6 pb-28 hide-scrollbar">
        {view === AppView.TIMELINE && (
          <div className="space-y-8 mt-6">
            {thoughts.length > 0 && (
               <div className="p-5 bg-white rounded-3xl border border-indigo-100 shadow-sm">
                <div className="flex gap-3">
                  <div className="text-indigo-600"><BrainIcon /></div>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium italic">"{dailyPrompt}"</p>
                </div>
              </div>
            )}
            
            {Object.keys(groupedThoughts).length === 0 ? (
              <div className="text-center py-20 opacity-50">
                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BrainIcon />
                </div>
                <h3 className="text-slate-900 font-bold">Start your stream</h3>
                <p className="text-slate-500 text-xs mt-1">Reflect, archive, and grow.</p>
              </div>
            ) : (
              Object.entries(groupedThoughts).map(([date, items]) => (
                <div key={date}>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-3">
                    <span className="h-px bg-slate-200 flex-1"></span>
                    {date}
                  </h3>
                  <div className="space-y-6">
                    {items.map((thought) => (
                      <ThoughtCard key={thought.id} thought={thought} onDelete={deleteThought} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === AppView.CALENDAR && (
          <div className="mt-6">
            <CalendarView 
                thoughts={thoughts} 
                onDateSelect={setSelectedDate} 
                selectedDate={selectedDate}
            />
            <div className="mt-8 space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} Entries
                </h3>
                {thoughts.filter(t => t.timestamp.toDateString() === selectedDate.toDateString()).map(thought => (
                    <ThoughtCard key={thought.id} thought={thought} onDelete={deleteThought} />
                ))}
            </div>
          </div>
        )}

        {view === AppView.INSIGHTS && (
            <div className="mt-6 space-y-6">
                <InsightsView thoughts={thoughts} />
            </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 ios-blur border-t border-slate-100 flex justify-around p-4 pb-10 z-30">
        <NavButton active={view === AppView.TIMELINE} onClick={() => setView(AppView.TIMELINE)} icon={<ListIcon />} label="Stream" />
        <NavButton active={view === AppView.CALENDAR} onClick={() => setView(AppView.CALENDAR)} icon={<CalendarIcon />} label="History" />
        <NavButton active={view === AppView.INSIGHTS} onClick={() => setView(AppView.INSIGHTS)} icon={<BrainIcon />} label="Growth" />
      </nav>

      {/* Input Modal */}
      {isInputOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-20 duration-300">
          <header className="p-4 pt-12 flex justify-between items-center border-b border-slate-50">
            <button onClick={() => setIsInputOpen(false)} className="text-slate-400 font-bold text-sm">Cancel</button>
            <h2 className="font-black text-slate-900">New Entry</h2>
            <button 
              onClick={handleAddThought}
              disabled={isAnalyzing || (!newThoughtText && newThoughtImages.length === 0)}
              className="text-indigo-600 font-black disabled:opacity-30 text-sm"
            >
              {isAnalyzing ? 'Analyzing...' : 'Save'}
            </button>
          </header>
          
          <div className="p-6 flex-1 flex flex-col gap-6">
            <div className="relative flex-1">
              <textarea
                autoFocus
                className="w-full text-xl leading-relaxed resize-none outline-none text-slate-800 placeholder:text-slate-200 h-full"
                placeholder="Talk or type..."
                value={newThoughtText}
                onChange={(e) => setNewThoughtText(e.target.value)}
              />
              {isRecording && (
                <div className="absolute top-0 right-0 flex items-center gap-2 px-3 py-1 bg-rose-50 rounded-full text-rose-500 animate-pulse">
                   <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                   <span className="text-[10px] font-black uppercase">Recording</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3 py-4 border-t border-slate-50">
               <button 
                onClick={toggleRecording}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {isRecording ? <MicOffIcon /> : <MicIcon />}
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all"
              >
                <CameraIcon />
              </button>

              <div className="flex-1 flex overflow-x-auto gap-2 hide-scrollbar">
                {newThoughtImages.map((img, i) => (
                  <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                    <img src={img} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setNewThoughtImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0 right-0 bg-slate-900/40 text-white rounded-bl-lg p-0.5"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              multiple 
              onChange={handleImageUpload} 
            />
          </div>
          {isAnalyzing && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-50">
              <div className="flex gap-2">
                 <div className="w-2 h-8 bg-indigo-600 animate-bounce [animation-delay:-0.3s]"></div>
                 <div className="w-2 h-8 bg-indigo-600 animate-bounce [animation-delay:-0.15s]"></div>
                 <div className="w-2 h-8 bg-indigo-600 animate-bounce"></div>
              </div>
              <p className="text-slate-900 font-black uppercase tracking-widest text-xs">Listener & Coach at work</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ThoughtCard: React.FC<{ thought: Thought, onDelete: (id: string) => void }> = ({ thought, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              thought.analysis?.sentiment === 'positive' ? 'bg-emerald-400' :
              thought.analysis?.sentiment === 'negative' ? 'bg-rose-400' : 'bg-blue-400'
            }`}></div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
              {thought.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button 
            onClick={() => onDelete(thought.id)}
            className="text-slate-200 hover:text-rose-500 transition-colors p-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
        
        <p className="text-slate-900 text-[15px] leading-relaxed font-medium mb-4 whitespace-pre-wrap">{thought.content}</p>
        
        {thought.images.length > 0 && (
          <div className={`grid gap-2 mb-4 ${thought.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {thought.images.map((img, i) => (
              <img key={i} src={img} className="rounded-2xl w-full h-44 object-cover shadow-sm" />
            ))}
          </div>
        )}

        {thought.analysis && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {thought.analysis.tags.map(tag => (
                <span key={tag} className="text-[10px] px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg font-bold">#{tag.toUpperCase()}</span>
              ))}
            </div>

            <button 
              onClick={() => setExpanded(!expanded)}
              className="w-full py-3 px-4 bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl text-[11px] font-black text-indigo-600 flex justify-between items-center transition-colors"
            >
              INSIGHTS FROM AI
              <svg className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>

            {expanded && (
              <div className="space-y-4 pt-2 animate-in slide-in-from-top-4 duration-300">
                <div className="flex gap-3">
                   <div className="text-slate-400 mt-0.5"><ListIcon /></div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Listener's Archive</p>
                      <p className="text-xs text-slate-600 leading-relaxed italic">{thought.analysis.summary}</p>
                   </div>
                </div>
                
                {thought.aiQuestions && thought.aiQuestions.length > 0 && (
                  <div className="flex gap-3">
                    <div className="text-indigo-600 mt-0.5"><BrainIcon /></div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Growth Prompt</p>
                        {thought.aiQuestions.map((q, i) => (
                          <p key={i} className="text-xs text-slate-900 font-bold leading-relaxed mb-2">
                            {q}
                          </p>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-indigo-600' : 'text-slate-300'}`}
  >
    <div className={`p-2 rounded-xl transition-all ${active ? 'bg-indigo-50 scale-110' : ''}`}>
      {icon}
    </div>
    <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
  </button>
);

const CalendarView: React.FC<{ thoughts: Thought[], onDateSelect: (d: Date) => void, selectedDate: Date }> = ({ thoughts, onDateSelect, selectedDate }) => {
  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();
  
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  
  const days = Array.from({ length: daysInMonth(month, year) }, (_, i) => i + 1);
  const offset = startDayOfMonth(month, year);
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const hasThought = (day: number) => {
    return thoughts.some(t => 
        t.timestamp.getDate() === day && 
        t.timestamp.getMonth() === month && 
        t.timestamp.getFullYear() === year
    );
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
      <div className="grid grid-cols-7 gap-y-4 text-center">
        {weekDays.map(d => <div key={d} className="text-[10px] font-black text-slate-200">{d}</div>)}
        {Array(offset).fill(null).map((_, i) => <div key={`off-${i}`}></div>)}
        {days.map(day => {
          const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month;
          const isToday = now.getDate() === day && now.getMonth() === month;
          return (
            <button 
              key={day} 
              onClick={() => onDateSelect(new Date(year, month, day))}
              className={`relative h-10 w-10 flex flex-col items-center justify-center rounded-2xl mx-auto transition-all ${
                isSelected ? 'bg-slate-900 text-white shadow-lg' : 
                isToday ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-700 font-bold'
              }`}
            >
              <span className="text-xs">{day}</span>
              {hasThought(day) && !isSelected && (
                <span className="absolute bottom-1 w-1 h-1 bg-indigo-400 rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const InsightsView: React.FC<{ thoughts: Thought[] }> = ({ thoughts }) => {
    const allTags = thoughts.flatMap(t => t.analysis?.tags || []);
    const tagCounts = allTags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sentiments = thoughts
      .map(t => t.analysis?.sentiment)
      .filter((s): s is 'positive' | 'neutral' | 'negative' => !!s);
    
    const sentimentCounts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    sentiments.forEach(s => {
      sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
    });

    const totalSentiments = sentiments.length;

    if (thoughts.length === 0) return (
      <div className="text-center py-20 opacity-30">
        <BrainIcon />
        <p className="mt-4 font-black uppercase tracking-widest text-xs">Awaiting data for analysis</p>
      </div>
    );

    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Mood Equilibrium</h3>
                <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-50">
                    <div className="bg-emerald-400 h-full transition-all duration-1000" style={{ width: `${totalSentiments > 0 ? (sentimentCounts.positive / totalSentiments * 100) : 0}%` }}></div>
                    <div className="bg-blue-400 h-full transition-all duration-1000" style={{ width: `${totalSentiments > 0 ? (sentimentCounts.neutral / totalSentiments * 100) : 0}%` }}></div>
                    <div className="bg-rose-400 h-full transition-all duration-1000" style={{ width: `${totalSentiments > 0 ? (sentimentCounts.negative / totalSentiments * 100) : 0}%` }}></div>
                </div>
                <div className="flex justify-between mt-4 text-[10px] font-black uppercase tracking-tighter text-slate-400">
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>Positive</div>
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>Neutral</div>
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>Negative</div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Topic Saturation</h3>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(tagCounts).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => (
                        <div key={tag} className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                            <span className="text-[11px] font-black text-slate-700">#{tag.toUpperCase()}</span>
                            <span className="text-[10px] font-black text-slate-300">{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-indigo-600 rounded-2xl">
                        <BrainIcon />
                    </div>
                    <h3 className="font-black uppercase tracking-widest text-xs">Growth Summary</h3>
                </div>
                <p className="text-sm leading-relaxed opacity-80 font-medium">
                    "Analyzing your current stream reveals a high density of thoughts regarding {Object.keys(tagCounts)[0] || 'life events'}. Your emotional baseline is currently {sentiments[0] || 'stable'}. Focus on the questions raised in your last entries to maintain this clarity."
                </p>
            </div>
        </div>
    );
};

export default App;
