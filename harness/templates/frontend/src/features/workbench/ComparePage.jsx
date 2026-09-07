import { sampleState } from '../../data/sample.js';
import Button from '../../components/Button.jsx';

const history = [
  { model: 'gpt-oss-120b', time: '2026-07-14 10:56', prompt: 'LCA 리포트는 무엇인가요?' },
  { model: 'gpt-oss-120b', time: '2026-07-14 10:42', prompt: '제품 생애주기 평가 정리' },
  { model: 'gpt-oss-120b', time: '2026-07-14 10:31', prompt: '탄소 배출량 계산 방법' },
];

export default function ComparePage() {
  return <section className="compare-view"><div className="toolbar"><strong>검색 결과</strong><div><Button>탭 보기</Button><Button variant="primary">여러 개 보기</Button><Button>답변 비교</Button></div></div><div className="result-cards">{history.map((item) => <article className="result-card" key={item.time}><div className="card-head"><strong>{item.model}</strong><button aria-label="닫기">×</button></div><small>local · {item.time}</small><p className="prompt-label">PROMPT</p><div className="prompt-box">{item.prompt}</div><p className="prompt-label">RESULT</p><h2>LCA (Life Cycle Assessment)란?</h2><p>{sampleState.result}</p></article>)}</div></section>;
}
