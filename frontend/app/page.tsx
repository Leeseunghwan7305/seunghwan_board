import UploadDropzone from "@/components/UploadDropzone";

export default function Home() {
  return (
    <div className="flex flex-col gap-10 motion-safe:animate-[fade-up_0.4s_ease-out]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          PDF에게 물어보세요
        </h1>
        <p className="max-w-xl font-body text-base text-muted">
          문서를 올리고 뭐든 물어보세요. 답이 어느 문장에서 나왔는지까지 콕
          짚어드려요.
        </p>
      </div>
      <div className="max-w-xl">
        <UploadDropzone />
      </div>
    </div>
  );
}
