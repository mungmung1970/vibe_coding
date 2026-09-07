/** 결과 조회 화면만 쓰는 상태(선택·숨김·탭·비교)를 사이드바와 본문이 함께 본다. */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as api from '../../services/api.js';
import { useWorkbench } from '../../state/WorkbenchContext.jsx';

const HistoryContext = createContext(null);

export function HistoryProvider({ children }) {
  const { setNotice, loadJudges } = useWorkbench();
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [hiddenRunIds, setHiddenRunIds] = useState([]);
  const [historyView, setHistoryView] = useState('grid');
  const [activeRunId, setActiveRunId] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [reference, setReference] = useState('');
  const [judgeModelId, setJudgeModelId] = useState('');
  const [comparing, setComparing] = useState(false);

  const toggleSelection = useCallback((runId) => {
    setSelectedRunIds((current) => (current.includes(runId) ? current.filter((id) => id !== runId) : [...current, runId]));
  }, []);

  /** X는 삭제가 아니라 화면에서 감추기만 한다. */
  const hideRun = useCallback((runId) => {
    setHiddenRunIds((current) => [...current, runId]);
    setSelectedRunIds((current) => current.filter((id) => id !== runId));
  }, []);

  /** 탭 닫기: 선택해 연 탭이면 선택에서 빼고, 기본으로 열린 탭이면 감춘다. 기록은 지우지 않는다. */
  const closeTab = useCallback((runId) => {
    setSelectedRunIds((current) => {
      if (!current.includes(runId)) { hideRun(runId); return current; }
      const remaining = current.filter((id) => id !== runId);
      setActiveRunId((active) => (active === runId ? remaining[0] ?? '' : active));
      return remaining;
    });
  }, [hideRun]);

  const openCompare = useCallback(async () => {
    if (selectedRunIds.length < 2) { setNotice('비교할 결과를 두 개 이상 선택해 주세요.'); return; }
    await loadJudges();
    setComparison({ pending: true });
  }, [loadJudges, selectedRunIds.length, setNotice]);

  const runCompare = useCallback(async () => {
    setComparing(true);
    try {
      setComparison(await api.compareRuns(selectedRunIds, { reference, judgeModelId }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setComparing(false);
    }
  }, [judgeModelId, reference, selectedRunIds, setNotice]);

  const value = useMemo(() => ({
    selectedRunIds, hiddenRunIds, historyView, activeRunId, contextMenu, comparison, reference, judgeModelId, comparing,
    toggleSelection, hideRun, closeTab, openCompare, runCompare,
    setHistoryView, setActiveRunId, setReference, setJudgeModelId,
    showAllRuns: () => setHiddenRunIds([]),
    openContextMenu: setContextMenu,
    closeContextMenu: () => setContextMenu(null),
    closeComparison: () => setComparison(null),
  }), [selectedRunIds, hiddenRunIds, historyView, activeRunId, contextMenu, comparison, reference, judgeModelId,
    comparing, toggleSelection, hideRun, closeTab, openCompare, runCompare]);

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const value = useContext(HistoryContext);
  if (!value) throw new Error('useHistory must be used within HistoryProvider');
  return value;
}
