export class CappedOutput {
  private readonly chunks: Buffer[] = [];
  private length = 0;
  truncated = false;

  constructor(private readonly maximumBytes: number) {}

  append(chunk: Buffer) {
    const remaining = this.maximumBytes - this.length;
    const retained = Math.min(remaining, chunk.length);
    if (retained > 0) {
      // Copy the retained prefix so a small slice cannot retain a large backing buffer.
      this.chunks.push(Buffer.from(chunk.subarray(0, retained)));
      this.length += retained;
    }
    if (chunk.length > retained) this.truncated = true;
  }

  bytes(): Buffer {
    return Buffer.concat(this.chunks, this.length);
  }
}
