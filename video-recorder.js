const { createFFmpeg, fetchFile } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/+esm');

export class VideoRecorder {

  static #ffmpeg; #rec; #chunks = [];

  constructor(video, name = 'recorded', mode = 'auto') {
    VideoRecorder.#initFFMpeg().finally(() => this.#initStream(video, name, mode));
  }

  get start() { return _ => this?.#rec?.state === 'inactive' && this.#rec.start(); }
  get stop() { return _ => this?.#rec?.state === 'recording' && this.#rec.stop(); }
  get ready() { return VideoRecorder.#ffmpeg?.ready; }

  #initStream(video, name, mode) {
    const stream = video.captureStream();

    stream.addEventListener('active', _ =>
      stream.addEventListener('addtrack', async _ => {
        const rec = this.#rec = new MediaRecorder(stream);

        rec.ondataavailable = ({ data }) => this.#chunks.push(data);
        rec.onstop = () => VideoRecorder.save(name, this.#chunks);

        if (mode === 'auto') {
          video.addEventListener('play', this.start);
          video.addEventListener('pause', this.stop);
        }
      }, { once: true }), { once: true });
  }

  static async #initFFMpeg() {
    if (this.#ffmpeg) return;
    if (!self.SharedArrayBuffer) return console.warn('SharedArrayBuffer not found: output video will not be seekable');

    this.#ffmpeg = createFFmpeg();
    this.#ffmpeg.ready = this.#ffmpeg.load();
    this.#ffmpeg.fetch = fetchFile;
    this.#ffmpeg.setProgress(({ ratio }) => console.log(`${ (ratio || 0) * 100 }%`));
  }

  static async save(name, chunks) {
    if (!chunks.length) return false;
    const videoBlob = new Blob(chunks, { type: 'video/webm' });
    const seekableBlob = this.#ffmpeg && await this.fixWebmCues(new File([ videoBlob ], name));

    this.download(seekableBlob || videoBlob, name);
    chunks.length = 0;
    return true
  }

  static async fixWebmCues(file) { // fix duration & make video seekable
    const { name } = file;
    const { FS, fetch, ready, run } = this.#ffmpeg;

    await ready;
    FS('writeFile', name, await fetch(file));
    await run('-i', name, '-c', 'copy', 'output.webm');
    const { buffer } = FS('readFile', 'output.webm');
    return new Blob([ buffer ], { type: 'video/webm' });
  }

  static download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `${ name }.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
Object.freeze(VideoRecorder);
Object.freeze(VideoRecorder.prototype);
