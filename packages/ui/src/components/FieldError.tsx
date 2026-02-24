export function FieldError({ message }: { message?: string }): JSX.Element | null {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
