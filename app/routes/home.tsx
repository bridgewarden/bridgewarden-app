export const meta = () => [
  { title: 'Bridgewarden' },
  { name: 'description', content: 'Zero-knowledge password manager, self-hosted on Cloudflare.' },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-6">
      <h1 className="text-3xl font-semibold">Bridgewarden</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Zero-knowledge password manager for personal and family use, deployed on Cloudflare.
      </p>
      <p className="text-sm text-gray-500">Setup and vault features arrive in the next milestones.</p>
    </main>
  );
}
