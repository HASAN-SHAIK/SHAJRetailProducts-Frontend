import React from 'react';

const RETAIL_HUB_URL = String(process.env.REACT_APP_RETAIL_HUB_URL || '').trim();

export default function OpeningSetup() {
  return (
    <div className="billing-page">
      <div className="billing-empty">
        <h3>Opening Setup moved to SHAJ Retail Hub</h3>
        <p>
          Complete the canonical opening setup in RetailHub. POS only consumes the
          resulting Central opening-completion state before enabling store execution.
        </p>
        <div className="d-flex gap-2 justify-content-center flex-wrap mt-3">
          {RETAIL_HUB_URL && (
            <a className="btn btn-primary" href={RETAIL_HUB_URL} target="_blank" rel="noreferrer">
              Open RetailHub
            </a>
          )}
          <button className="btn btn-outline-primary" type="button" onClick={() => window.location.reload()}>
            Refresh setup status
          </button>
        </div>
      </div>
    </div>
  );
}
