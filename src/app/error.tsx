"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="page">
      <h1>Algo interrompeu a história.</h1>
      <p>Tente carregar esta tela novamente.</p>
      <button className="primary-button" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
