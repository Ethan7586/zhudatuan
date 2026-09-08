import { useEffect, useRef, useState } from 'react';

interface Detector {
  detect(source: HTMLVideoElement): Promise<readonly Readonly<{ rawValue?: string }>[]>;
}

type DetectorConstructor = new (options?: Readonly<{ formats?: readonly string[] }>) => Detector;

export function CameraScanner({ onValue, onClose }: Readonly<{ onValue: (value: string) => void; onClose: () => void }>) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const DetectorType = Reflect.get(globalThis, 'BarcodeDetector') as DetectorConstructor | undefined;
    if (DetectorType === undefined || navigator.mediaDevices?.getUserMedia === undefined) {
      setError('当前浏览器不支持相机扫码，请使用扫码枪或键盘输入。');
      return;
    }
    const detector = new DetectorType({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8'] });
    const inspect = async () => {
      const target = video.current;
      if (!active || target === null) return;
      try {
        const result = await detector.detect(target);
        const value = result.find((item) => typeof item.rawValue === 'string' && item.rawValue.trim())?.rawValue?.trim();
        if (value) {
          onValue(value);
          return;
        }
      } catch {
        if (active) setError('暂时无法识别，请对准二维码或改用键盘输入。');
      }
      if (active) timer = window.setTimeout(inspect, 250);
    };
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((value) => {
        if (!active) {
          value.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = value;
        if (video.current) {
          video.current.srcObject = value;
          void video.current.play().then(inspect);
        }
      })
      .catch(() => setError('无法使用相机，请检查权限，或直接使用扫码枪和键盘。'));
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onValue]);

  return (
    <div className="camerascanner" role="dialog" aria-modal="true" aria-label="相机扫码">
      <div>
        <header>
          <strong>对准条码或二维码</strong>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>
        {error ? <p role="alert">{error}</p> : <video ref={video} muted playsInline aria-label="扫码相机画面" />}
      </div>
    </div>
  );
}
