import React from 'react';

const menus = ['신규 생성', '조회 및 수정', '매칭결과 테스트'];

export default function Topbar({ menu, setMenu }) {
  return <header className="topbar">
    <div className="brand"><span className="brand-mark">◈</span><strong>LCI 물질명 매칭</strong></div>
    <nav className="top-menu" aria-label="상단 메뉴">
      {menus.map((item, index) => <button key={item} className={menu === index ? 'active' : ''} onClick={() => setMenu(index)}>{item}</button>)}
    </nav>
  </header>;
}
