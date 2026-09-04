export function EnrollmentError({ message }: Readonly<{ message: string }>) {
  return (
    <p className="enrollmenterror" role="alert" aria-live="assertive">
      {message}
    </p>
  );
}
