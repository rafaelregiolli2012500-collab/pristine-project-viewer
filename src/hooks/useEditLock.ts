/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const LOCK_KEY = 'edit_lock';
const HEARTBEAT_INTERVAL = 3000;
const LOCK_TIMEOUT = 10000;
const DEV_FORCE_KEY = 'edit_lock_force';

interface LockState {
  tabId: string;
  timestamp: number;
}

function generateTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useEditLock() {
  const tabIdRef = useRef(generateTabId());
  const [isEditor, setIsEditor] = useState(false);
  const [otherTabActive, setOtherTabActive] = useState(false);
  const [wasForceDisconnected, setWasForceDisconnected] = useState(false);

  const tryAcquireLock = useCallback(() => {
    // Check if we were force-disconnected
    const forceData = localStorage.getItem(DEV_FORCE_KEY);
    if (forceData) {
      try {
        const force = JSON.parse(forceData);
        if (force.tabId !== tabIdRef.current && Date.now() - force.timestamp < 15000) {
          setIsEditor(false);
          setOtherTabActive(true);
          setWasForceDisconnected(true);
          return;
        }
      } catch {}
    }

    const raw = localStorage.getItem(LOCK_KEY);
    if (raw) {
      try {
        const lock: LockState = JSON.parse(raw);
        if (lock.tabId !== tabIdRef.current && Date.now() - lock.timestamp < LOCK_TIMEOUT) {
          setIsEditor(false);
          setOtherTabActive(true);
          return;
        }
      } catch {}
    }
    const newLock: LockState = { tabId: tabIdRef.current, timestamp: Date.now() };
    localStorage.setItem(LOCK_KEY, JSON.stringify(newLock));
    setIsEditor(true);
    setOtherTabActive(false);
    setWasForceDisconnected(false);
  }, []);

  const forceDisconnectOthers = useCallback(() => {
    // Set force flag so other tabs know they were kicked
    localStorage.setItem(DEV_FORCE_KEY, JSON.stringify({ tabId: tabIdRef.current, timestamp: Date.now() }));
    // Acquire lock immediately
    const newLock: LockState = { tabId: tabIdRef.current, timestamp: Date.now() };
    localStorage.setItem(LOCK_KEY, JSON.stringify(newLock));
    setIsEditor(true);
    setOtherTabActive(false);
    setWasForceDisconnected(false);
    // Clean force key after timeout
    setTimeout(() => {
      const raw = localStorage.getItem(DEV_FORCE_KEY);
      if (raw) {
        try {
          const f = JSON.parse(raw);
          if (f.tabId === tabIdRef.current) localStorage.removeItem(DEV_FORCE_KEY);
        } catch {}
      }
    }, 16000);
  }, []);

  useEffect(() => {
    tryAcquireLock();

    const heartbeat = setInterval(() => {
      if (isEditor) {
        const lock: LockState = { tabId: tabIdRef.current, timestamp: Date.now() };
        localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
      } else {
        tryAcquireLock();
      }
    }, HEARTBEAT_INTERVAL);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCK_KEY || e.key === DEV_FORCE_KEY) {
        tryAcquireLock();
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleUnload = () => {
      const raw = localStorage.getItem(LOCK_KEY);
      if (raw) {
        try {
          const lock: LockState = JSON.parse(raw);
          if (lock.tabId === tabIdRef.current) localStorage.removeItem(LOCK_KEY);
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [isEditor, tryAcquireLock]);

  return { isEditor, otherTabActive, wasForceDisconnected, forceDisconnectOthers, tabId: tabIdRef.current };
}
