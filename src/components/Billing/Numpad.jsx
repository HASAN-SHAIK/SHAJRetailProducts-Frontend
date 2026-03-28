import React from 'react';

const Numpad = ({ value, onChange }) => {
  const append = (digit) => {
    const next = `${value || ''}${digit}`.replace(/^0+(\d)/, '$1');
    onChange(next);
  };

  const backspace = () => {
    const next = String(value || '').slice(0, -1);
    onChange(next);
  };

  return (
    <div className="billing-numpad">
      <div className="numpad-display">{value || '0'}</div>
      <div className="numpad-grid">
        {['1','2','3','4','5','6','7','8','9'].map((digit) => (
          <button key={digit} type="button" className="numpad-btn" onClick={() => append(digit)}>
            {digit}
          </button>
        ))}
        <button type="button" className="numpad-btn" onClick={() => append('0')}>0</button>
        <button type="button" className="numpad-btn secondary" onClick={backspace}>BS</button>
        <button type="button" className="numpad-btn secondary" onClick={() => onChange('')}>C</button>
      </div>
    </div>
  );
};

export default Numpad;
