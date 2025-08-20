import Link from "next/link";

export default async function HomePage() {
  return (
    <div className="min-h-screen mx-auto py-16 max-w-7xl space-y-16">
      <Link href="/editor" className="text-2xl font-bold px-4 py-2 rounded-md bg-blue-500 text-white">
        번역하러가기
      </Link>
      <Link href="/editor2" className="text-2xl font-bold px-4 py-2 rounded-md bg-blue-500 text-white">
        번역하러가기2
      </Link>
    </div>
  );
}
