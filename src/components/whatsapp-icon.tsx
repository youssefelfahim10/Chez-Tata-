/** Pictogramme WhatsApp simplifié (bulle + combiné). Vous pouvez le remplacer par l'illustration officielle de la marque. */
export function WhatsAppIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} focusable="false">
      <path
        fill="currentColor"
        d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8A13 13 0 0 0 16 29c7.2 0 13-5.8 13-13S23.2 3 16 3z"
      />
      <path
        fill="#25D366"
        d="M21.9 19.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.7-.8-2.9-1.5-4-3.1-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.2.2 2.2 3.4 5.4 4.7 2 .8 2.8.9 3.8.7.6-.1 1.8-.7 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.4z"
      />
    </svg>
  );
}
