import { useState } from 'react';
import Button from '../../components/Button.jsx';
import { sampleState } from '../../data/sample.js';
import { runModel } from '../../services/modelService.js';

export default function PromptPage() {
  const [prompt, setPrompt] = useState(sampleState.prompt); const [result, setResult] = useState(sampleState.result); const [error, setError] = useState('');
  const submit = async (event) => { event?.preventDefault(); try { setError(''); setResult(await runModel(prompt, sampleState.model)); } catch (reason) { setError(reason.message); } };
  return <div className="prompt-grid"><section className="panel input-panel"><div className="panel-title">입력 <Button variant="icon" onClick={submit} aria-label="질문 실행">➤</Button></div><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())} aria-label="질문 입력" /><div className="panel-footer">{error || 'Enter로 실행 · Shift + Enter로 줄바꿈'}</div></section><section className="panel answer-panel"><div className="panel-title">답변 <span className="actions">▣　↗　◉</span></div><div className="model-meta"><strong>{sampleState.model}</strong><span>ESG 투자 판단 근거</span></div><article className="answer"><h1>LCA (Life Cycle Assessment)란?</h1><p>{result}</p><h2>핵심 내용</h2><table><tbody><tr><th>목적</th><td>제품, 공정, 서비스의 환경 영향을 정량적으로 평가</td></tr><tr><th>범위</th><td>원료 채취부터 폐기까지 전 생애주기</td></tr><tr><th>활용</th><td>개선 방향 도출 및 의사결정 지원</td></tr></tbody></table></article></section></div>;
}
