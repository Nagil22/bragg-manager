import { useState, useCallback, useEffect, useMemo, startTransition } from 'react';
import { FileMeta, Recommendation } from '../../shared/types';

export function useStorage() {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [ruleRecs, setRuleRecs] = useState<Recommendation[]>([]);
  const [aiEnhancedRecs, setAiEnhancedRecs] = useState<Recommendation[]>([]);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  // Restore last scan from disk on mount
  useEffect(() => {
    window.storeSmartAPI.loadScanCache()
      .then(cache => {
        if (cache?.files?.length) {
          // startTransition: marks as non-urgent so UI stays responsive while React
          // recomputes 16k-file derived state (dynamicCategories, driveCandidates, etc.)
          startTransition(() => {
            setFiles(cache.files);
            setRuleRecs(cache.recs ?? []);
          });
        }
      })
      .catch(() => {})
      .finally(() => setCacheLoaded(true));
  }, []);

  const scan = useCallback(async (dirPath: string) => {
    setIsScanning(true);
    setScanProgress(0);

    const progressHandler = (_: any, pct: number) => setScanProgress(pct);
    window.storeSmartAPI.onScanProgress(progressHandler);

    try {
      const result = await window.storeSmartAPI.scanDirectory(dirPath);
      if (result === null) return null; // cancelled
      const { files: fileList, recs } = result;
      startTransition(() => {
        setFiles(fileList);
        setRuleRecs(recs);
        setAiEnhancedRecs([]);
        setSkippedIds(new Set());
      });
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      window.storeSmartAPI.offScanProgress(progressHandler);
      setScanProgress(100);
      setIsScanning(false);
    }
  }, []);

  const enhanceWithAI = useCallback(async () => {
    if (!ruleRecs.length) return;
    try {
      const enhanced = await window.storeSmartAPI.enhanceWithAI(ruleRecs);
      setAiEnhancedRecs(enhanced);
    } catch (error) {
      console.error('AI enhancement failed:', error);
    }
  }, [ruleRecs]);

  /** Remove files from state by ID and re-derive rule recs — no re-scan needed. */
  const removeFiles = useCallback(async (ids: Set<string>) => {
    const updated = files.filter(f => !ids.has(f.id));
    setFiles(updated);
    try {
      const recs = await window.storeSmartAPI.getRuleRecommendations(updated);
      setRuleRecs(recs);
      if (aiEnhancedRecs.length) {
        setAiEnhancedRecs(prev =>
          prev
            .map(r => ({ ...r, files: r.files.filter(f => !ids.has(f.id)) }))
            .filter(r => r.files.length > 0)
        );
      }
    } catch (err) {
      console.error('Failed to refresh recommendations:', err);
    }
  }, [files, aiEnhancedRecs]);

  /** Remove a recommendation card for the session (files stay on disk). */
  const skipRec = useCallback((id: string) => {
    setSkippedIds(prev => new Set([...prev, id]));
  }, []);

  const displayedRecs = useMemo(
    () => (aiEnhancedRecs.length > 0 ? aiEnhancedRecs : ruleRecs).filter(r => !skippedIds.has(r.id)),
    [aiEnhancedRecs, ruleRecs, skippedIds]
  );

  return {
    files,
    displayedRecs,
    isScanning,
    scanProgress,
    scan,
    enhanceWithAI,
    removeFiles,
    skipRec,
    cacheLoaded,
  };
}
