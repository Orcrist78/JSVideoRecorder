/**
 *  ISC License
 *  Copyright (c) 2023, Giuseppe Scotto Lavina
 *
 *  Permission to use, copy, modify, and/or distribute this software for any
 *  purpose with or without fee is hereby granted, provided that the above
 *  copyright notice and this permission notice appear in all copies.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 *  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 *  AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 *  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 *  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
 *  OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 *  PERFORMANCE OF THIS SOFTWARE.
**/

const { createFFmpeg, fetchFile } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/+esm');

export class VideoRecorder {
  static get version() { return  '0.0.2'; };

  static #ffmpeg;

  #rec; #chunks = [];

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
        rec.onstop = () => VideoRecorder.save(this.#chunks, name);

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

  static async save(chunks, name = 'o.webm') {
    if (!chunks.length) return false;
    const videoBlob = new Blob(chunks, { type: 'video/webm' });
    const seekableBlob = this.#ffmpeg && await this.fixWebmCues(videoBlob);

    this.download(seekableBlob || videoBlob, name);
    chunks.length = 0;
    return true
  }

  static async fixWebmCues(blob) { // fix duration & make video seekable
    const src = 'i.webm', dst = 'o.webm';
    const file = new File([ blob ], src);
    const { FS, fetch, ready, run } = this.#ffmpeg;

    await ready;
    FS('writeFile', src, await fetch(file));
    await run('-i', src, '-c', 'copy', dst);
    const { buffer } = FS('readFile', dst);
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
