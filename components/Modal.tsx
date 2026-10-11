'use client';
import { useEffect } from 'react';

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(2px)'
      }} 
      onClick={onClose}
    >
      <div 
        className="panel" 
        style={{ width: '100%', maxWidth: 1200, maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }} 
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 className="grow" style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div style={{ flexGrow: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}