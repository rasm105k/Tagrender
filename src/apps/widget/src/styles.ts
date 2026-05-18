export const styles = `
  :host {
    all: initial;
    color: #111827;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  * {
    box-sizing: border-box;
    font-family: inherit;
  }

  .card {
    width: min(100%, 440px);
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 10px 30px rgba(17, 24, 39, 0.08);
    overflow: hidden;
  }

  .header {
    padding: 18px 18px 14px;
    border-bottom: 1px solid #f3f4f6;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .subtitle {
    margin: 6px 0 0;
    color: #6b7280;
    font-size: 13px;
    line-height: 1.45;
  }

  .body {
    padding: 16px 18px 18px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    color: #4b5563;
    font-size: 12px;
    font-weight: 650;
  }

  input {
    width: 100%;
    min-height: 40px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px 10px;
    color: #111827;
    font-size: 14px;
    outline: none;
  }

  input:focus {
    border-color: #111827;
    box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
  }

  button {
    min-height: 40px;
    border: 0;
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  button.secondary {
    border: 1px solid #d1d5db;
    background: #fff;
    color: #111827;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .stack {
    display: grid;
    gap: 12px;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .row > * {
    flex: 1;
  }

  .suggestions {
    display: grid;
    gap: 6px;
    margin-top: 8px;
  }

  .suggestion {
    width: 100%;
    min-height: 34px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #111827;
    text-align: left;
    font-weight: 550;
  }

  .estimate {
    display: grid;
    gap: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
    padding: 12px;
  }

  .price {
    font-size: 28px;
    font-weight: 800;
  }

  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    color: #6b7280;
    font-size: 12px;
  }

  .status {
    border-radius: 6px;
    background: #f3f4f6;
    padding: 8px 10px;
    color: #374151;
    font-size: 13px;
  }

  .error {
    background: #fef2f2;
    color: #991b1b;
  }
`
