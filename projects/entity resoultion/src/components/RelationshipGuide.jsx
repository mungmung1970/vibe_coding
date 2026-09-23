import React from 'react';
import { RELATION_GROUPS } from '../data/relationExamples.js';

export default function RelationshipGuide({ onOpenExample }) {
  return <section className="relation-guide">
    <div className="guide-head"><span className="eyebrow">RELATIONSHIP DICTIONARY</span><h2>물질 관계 예시</h2><p>카드를 클릭하면 지식 그래프 조회로 이동해 예시 용어를 검색합니다.</p></div>
    <div className="relation-groups">{RELATION_GROUPS.map((group) => <section className="relation-group" key={group.title}><header><span>{group.title}</span><code>{group.relation}</code></header>{group.items.map(([name, description, query]) => <button key={name} onClick={() => onOpenExample(query)}><b>{name}</b><span>{description}</span></button>)}</section>)}</div>
  </section>;
}
