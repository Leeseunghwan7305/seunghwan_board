import UploadDropzone from "@/components/UploadDropzone";

export default function Home() {
  return (
    <div className="flex flex-col gap-10 motion-safe:animate-[fade-up_0.4s_ease-out]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          Upload PDF
        </h1>
        <p className="max-w-xl font-body text-base text-muted">
          Upload a PDF and ask it anything — every answer shows the passage
          it came from.
        </p>
      </div>
      <div className="max-w-xl">
        <UploadDropzone />
      </div>
    </div>
  );
}
