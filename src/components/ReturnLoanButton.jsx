import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';

/** Žádost o vrácení knihy z knihovny: první klik se ptá, druhý ji odešle knihovníkovi. */
export default function ReturnLoanButton({ disabled, onConfirm }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" disabled={disabled} onClick={() => setArmed(true)}>
        <Undo2 size={14} /> Vrátit
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        Potvrdit vrácení
      </button>
      <button type="button" onClick={() => setArmed(false)}>Zpět</button>
    </>
  );
}
