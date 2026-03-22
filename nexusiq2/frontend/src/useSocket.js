import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL || '';

export function useSocket(handlers={}) {
  const ref = useRef(null);
  useEffect(()=>{
    const s = io(URL, { transports:['websocket','polling'], reconnectionAttempts:10 });
    ref.current = s;
    s.on('connect',    ()=>console.log('[Socket] connected'));
    s.on('disconnect', r =>console.log('[Socket] disconnected:',r));
    Object.entries(handlers).forEach(([ev,fn])=>s.on(ev,fn));
    return ()=>{ Object.keys(handlers).forEach(ev=>s.off(ev)); s.disconnect(); };
  },[]);
  return ref;
}
