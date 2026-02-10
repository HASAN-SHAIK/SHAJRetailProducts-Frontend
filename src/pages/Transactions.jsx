import React from 'react'
import TransactionsPage from '../components/TransactionPage/TransactionsPage'

export default function Transactions({navigate}) {
  return (
    <div className="wow-page">
      <div className="wow-motion-layer" aria-hidden="true">
        <span className="wow-orb orb-a"></span>
        <span className="wow-orb orb-b"></span>
        <span className="wow-orb orb-c"></span>
        <span className="wow-orb orb-d"></span>
        <span className="wow-ring ring-a"></span>
        <span className="wow-ring ring-b"></span>
        <span className="wow-pulse"></span>
      </div>
      <div className="wow-content">
        <TransactionsPage navigate={navigate} />
      </div>
    </div>
  )
}
