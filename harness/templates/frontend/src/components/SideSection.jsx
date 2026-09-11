import { useState } from 'react';

/** 좌측 상자. 헤더를 눌러 접고 펼 수 있다. */
export default function SideSection({ title, extra = null, defaultOpen = true, className = '', children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`side-section ${open ? '' : 'is-collapsed'}`}>
      <h2>
        <button type="button" className="side-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>{title}
        </button>
        {extra}
      </h2>
      {open && <div className={`side-body ${className}`}>{children}</div>}
    </section>
  );
}

