/** 음성·영상 결과는 브라우저 기본 플레이어로 듣고 본다. */
export default function MediaPlayer({ media }) {
  if (!media?.url) return null;
  const megabytes = (media.bytes ?? 0) / 1024 / 1024;
  return (
    <div className="media-result">
      {media.mime?.startsWith('video/')
        ? <video className="media-player" src={media.url} controls preload="metadata" />
        : <audio className="media-player" src={media.url} controls preload="metadata" />}
      <small>
        {media.name} · {megabytes.toFixed(megabytes >= 1 ? 1 : 2)}MB ·{' '}
        <a href={media.url} target="_blank" rel="noreferrer">새 창에서 열기</a>
      </small>
    </div>
  );
}
