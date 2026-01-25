'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const noteStrings = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];
const noteKeys = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function frequencyToNote(frequency) {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  const midiNote = Math.round(noteNum) + 69;
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  const cents = Math.round((noteNum - Math.round(noteNum)) * 100);
  return { note: noteStrings[noteIndex], noteKey: noteKeys[noteIndex], octave, cents, midiNote, noteIndex };
}

function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  }

  const buf = buffer.slice(r1, r2);
  const newSize = buf.length;
  const c = new Array(newSize).fill(0);

  for (let i = 0; i < newSize; i++) {
    for (let j = 0; j < newSize - i; j++) {
      c[i] += buf[j] * buf[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxVal = -1, maxPos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  let T0 = maxPos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

// 音階グラフコンポーネント
function PitchGraph({ history }) {
  const graphWidth = 600;
  const graphHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = graphWidth - padding.left - padding.right;
  const innerHeight = graphHeight - padding.top - padding.bottom;

  const displayData = history.slice(-80);
  
  if (displayData.length === 0) {
    return (
      <div style={{
        width: '100%',
        maxWidth: `${graphWidth}px`,
        height: `${graphHeight}px`,
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <span style={{ color: '#444', fontSize: '14px' }}>音を検出するとグラフが表示されます</span>
      </div>
    );
  }

  const midiNotes = displayData.map(d => d.midiNote);
  const minMidi = Math.min(...midiNotes);
  const maxMidi = Math.max(...midiNotes);
  
  const range = Math.max(maxMidi - minMidi, 12);
  const yMin = Math.floor((minMidi + maxMidi - range) / 2);
  const yMax = yMin + range;

  const xScale = (i) => padding.left + (i / (displayData.length - 1 || 1)) * innerWidth;
  const yScale = (midi) => padding.top + innerHeight - ((midi - yMin) / (yMax - yMin)) * innerHeight;

  const pathData = displayData.map((d, i) => {
    const x = xScale(i);
    const y = yScale(d.midiNote);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaPath = `${pathData} L ${xScale(displayData.length - 1)} ${graphHeight - padding.bottom} L ${padding.left} ${graphHeight - padding.bottom} Z`;

  const yLabels = [];
  for (let midi = yMin; midi <= yMax; midi++) {
    const noteIndex = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    if (![1, 3, 6, 8, 10].includes(noteIndex)) {
      yLabels.push({ midi, note: noteStrings[noteIndex], octave });
    }
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: `${graphWidth}px`,
      background: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '16px',
      padding: '16px',
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      <h3 style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '14px',
        color: '#666',
        margin: '0 0 12px 0',
        textTransform: 'uppercase',
        letterSpacing: '2px'
      }}>
        音階グラフ
      </h3>
      <svg width="100%" viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00f5d4" />
            <stop offset="50%" stopColor="#00bbf9" />
            <stop offset="100%" stopColor="#9b5de5" />
          </linearGradient>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 245, 212, 0.3)" />
            <stop offset="100%" stopColor="rgba(0, 245, 212, 0)" />
          </linearGradient>
        </defs>

        {yLabels.map(({ midi }) => (
          <line
            key={midi}
            x1={padding.left}
            y1={yScale(midi)}
            x2={graphWidth - padding.right}
            y2={yScale(midi)}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="4,4"
          />
        ))}

        <path d={areaPath} fill="url(#areaGradient)" />

        <path
          d={pathData}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {displayData.length > 0 && (
          <circle
            cx={xScale(displayData.length - 1)}
            cy={yScale(displayData[displayData.length - 1].midiNote)}
            r="6"
            fill="#00f5d4"
            style={{ filter: 'drop-shadow(0 0 8px #00f5d4)' }}
          />
        )}

        {yLabels.map(({ midi, note, octave }) => (
          <text
            key={midi}
            x={padding.left - 8}
            y={yScale(midi) + 4}
            textAnchor="end"
            fill="#666"
            fontSize="11"
            fontFamily="'Orbitron', sans-serif"
          >
            {note}{octave}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function PitchDetector() {
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState(null);
  const [noteInfo, setNoteInfo] = useState(null);
  const [volume, setVolume] = useState(0);
  const [history, setHistory] = useState([]);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  const detect = useCallback(() => {
    if (!analyserRef.current) return;

    analyserRef.current.getFloatTimeDomainData(dataArrayRef.current);
    const frequency = autoCorrelate(dataArrayRef.current, audioContextRef.current.sampleRate);

    let rms = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      rms += dataArrayRef.current[i] * dataArrayRef.current[i];
    }
    rms = Math.sqrt(rms / dataArrayRef.current.length);
    setVolume(Math.min(rms * 5, 1));

    if (frequency > 50 && frequency < 2000) {
      setPitch(frequency);
      const info = frequencyToNote(frequency);
      setNoteInfo(info);
      setHistory(prev => {
        const newHistory = [...prev, { frequency, note: info.note, octave: info.octave, midiNote: info.midiNote, noteIndex: info.noteIndex, time: Date.now() }];
        return newHistory.slice(-200);
      });
    } else {
      setPitch(null);
      setNoteInfo(null);
    }

    animationRef.current = requestAnimationFrame(detect);
  }, []);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      dataArrayRef.current = new Float32Array(analyserRef.current.fftSize);
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      setIsListening(true);
      setHistory([]);
      detect();
    } catch (err) {
      console.error('マイクへのアクセスが拒否されました:', err);
    }
  };

  const stopListening = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsListening(false);
    setPitch(null);
    setNoteInfo(null);
    setVolume(0);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const centsOffset = noteInfo ? noteInfo.cents : 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      color: '#e0e0e0',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '24px'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@300;400;500&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
        @keyframes glow { 0%, 100% { filter: drop-shadow(0 0 20px currentColor); } 50% { filter: drop-shadow(0 0 40px currentColor); } }
      `}</style>

      <h1 style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 'clamp(24px, 5vw, 40px)',
        fontWeight: 900,
        background: 'linear-gradient(90deg, #00f5d4, #00bbf9, #9b5de5)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textTransform: 'uppercase',
        letterSpacing: '4px',
        margin: 0,
        textAlign: 'center'
      }}>
        音程検出器
      </h1>

      <button
        onClick={isListening ? stopListening : startListening}
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: '16px',
          fontWeight: 700,
          padding: '14px 40px',
          border: 'none',
          borderRadius: '50px',
          cursor: 'pointer',
          background: isListening 
            ? 'linear-gradient(135deg, #ff006e, #fb5607)' 
            : 'linear-gradient(135deg, #00f5d4, #00bbf9)',
          color: '#0a0a0f',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          boxShadow: isListening 
            ? '0 0 30px rgba(255, 0, 110, 0.5)' 
            : '0 0 30px rgba(0, 245, 212, 0.5)',
          transition: 'all 0.3s ease',
          animation: isListening ? 'pulse 2s infinite' : 'none'
        }}
      >
        {isListening ? '⬛ 停止' : '▶ 開始'}
      </button>

      <div style={{
        width: '100%',
        maxWidth: '500px',
        height: '6px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '3px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${volume * 100}%`,
          height: '100%',
          background: `linear-gradient(90deg, #00f5d4, ${volume > 0.7 ? '#ff006e' : '#00bbf9'})`,
          borderRadius: '3px',
          transition: 'width 0.05s ease'
        }} />
      </div>

      <div style={{
        background: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '24px',
        padding: '30px',
        width: '100%',
        maxWidth: '500px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}>
        <div style={{
          fontSize: 'clamp(60px, 18vw, 100px)',
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: 900,
          textAlign: 'center',
          color: noteInfo ? '#00f5d4' : '#333',
          textShadow: noteInfo ? '0 0 60px rgba(0, 245, 212, 0.8)' : 'none',
          animation: noteInfo ? 'glow 2s infinite' : 'none',
          lineHeight: 1,
          marginBottom: '8px'
        }}>
          {noteInfo ? `${noteInfo.note}${noteInfo.octave}` : '--'}
        </div>

        <div style={{
          fontSize: '20px',
          fontWeight: 300,
          textAlign: 'center',
          color: '#888',
          marginBottom: '24px'
        }}>
          {pitch ? `${pitch.toFixed(1)} Hz` : '音を検出中...'}
        </div>

        <div style={{
          position: 'relative',
          height: '50px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: '16px'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            width: '2px',
            height: '100%',
            background: '#00f5d4',
            boxShadow: '0 0 10px #00f5d4'
          }} />
          
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${50 + centsOffset / 2}%`,
            transform: 'translate(-50%, -50%)',
            width: '14px',
            height: '34px',
            background: Math.abs(centsOffset) < 10 
              ? 'linear-gradient(180deg, #00f5d4, #00bbf9)' 
              : 'linear-gradient(180deg, #ff006e, #fb5607)',
            borderRadius: '7px',
            boxShadow: Math.abs(centsOffset) < 10 
              ? '0 0 20px rgba(0, 245, 212, 0.8)' 
              : '0 0 20px rgba(255, 0, 110, 0.8)',
            transition: 'left 0.1s ease'
          }} />

          <div style={{ position: 'absolute', bottom: '4px', left: '10%', fontSize: '11px', color: '#555' }}>-50¢</div>
          <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: '#00f5d4' }}>0¢</div>
          <div style={{ position: 'absolute', bottom: '4px', right: '10%', fontSize: '11px', color: '#555' }}>+50¢</div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          fontSize: '16px'
        }}>
          <span style={{ color: '#666' }}>セント:</span>
          <span style={{
            color: Math.abs(centsOffset) < 10 ? '#00f5d4' : '#ff006e',
            fontWeight: 500
          }}>
            {centsOffset > 0 ? '+' : ''}{centsOffset}¢
          </span>
          <span style={{
            fontSize: '13px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: Math.abs(centsOffset) < 10 
              ? 'rgba(0, 245, 212, 0.2)' 
              : 'rgba(255, 0, 110, 0.2)',
            color: Math.abs(centsOffset) < 10 ? '#00f5d4' : '#ff006e'
          }}>
            {Math.abs(centsOffset) < 5 ? '完璧!' : Math.abs(centsOffset) < 10 ? '良好' : centsOffset > 0 ? '高い ↑' : '低い ↓'}
          </span>
        </div>
      </div>

      <PitchGraph history={history} />

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '3px',
        padding: '14px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '12px'
      }}>
        {noteStrings.map((note, i) => {
          const isSharp = note.includes('♯');
          const isActive = noteInfo && noteInfo.note === note;
          return (
            <div
              key={note}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <div
                style={{
                  width: isSharp ? '22px' : '32px',
                  height: isSharp ? '50px' : '70px',
                  background: isActive
                    ? 'linear-gradient(180deg, #00f5d4, #00bbf9)'
                    : isSharp 
                      ? '#1a1a2e' 
                      : 'linear-gradient(180deg, #2a2a3e, #1a1a2e)',
                  borderRadius: '0 0 5px 5px',
                  border: `1px solid ${isActive ? '#00f5d4' : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: isActive 
                    ? '0 0 20px rgba(0, 245, 212, 0.6)' 
                    : 'inset 0 -10px 20px rgba(0,0,0,0.3)',
                  marginTop: isSharp ? '0' : '20px',
                  transition: 'all 0.1s ease',
                  position: 'relative',
                  zIndex: isSharp ? 2 : 1
                }}
              />
              {!isSharp && (
                <span style={{
                  fontSize: '10px',
                  color: isActive ? '#00f5d4' : '#555',
                  fontFamily: "'Orbitron', sans-serif"
                }}>
                  {note}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p style={{
        fontSize: '11px',
        color: '#444',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        マイクに向かって音を出すと、リアルタイムで音程を検出します。
      </p>
    </div>
  );
}
