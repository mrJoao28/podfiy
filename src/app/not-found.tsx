import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page">
      <h1>Essa história não está aqui.</h1>
      <Link href="/" className="primary-button">
        Voltar ao início
      </Link>
    </div>
  );
}
