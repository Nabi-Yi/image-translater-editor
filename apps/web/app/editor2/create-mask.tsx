/**
 * 주어진 Bounding Box 정보를 이용해 마스킹 이미지를 생성하고 다운로드합니다.
 * @param originalWidth 원본 이미지의 너비
 * @param originalHeight 원본 이미지의 높이
 * @param bboxes 마스킹할 영역의 Bounding Box 배열. 형식: [{ x: number, y: number, width: number, height: number }]
 * @param filename 생성될 파일의 이름
 */
export function createAndDownloadMask(
  originalWidth: number,
  originalHeight: number,
  bboxes: { x: number; y: number; width: number; height: number }[],
  filename: string,
): void {
  // HTML <canvas> 요소를 동적으로 생성
  const canvas = document.createElement("canvas");
  canvas.width = originalWidth;
  canvas.height = originalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 배경을 검은색으로 채우기
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, originalWidth, originalHeight);

  // 각 bbox 영역을 흰색으로 채우기
  ctx.fillStyle = "white";
  bboxes.forEach((bbox) => {
    // x, y, width, height 형식에서 xmin, ymin, xmax, ymax 형식으로 변환
    const xmin = bbox.x;
    const ymin = bbox.y;
    const width = bbox.width;
    const height = bbox.height;

    // 변환된 좌표를 사용하여 사각형 그리기
    ctx.fillRect(xmin, ymin, width, height);
  });

  // 캔버스의 내용을 PNG 데이터 URL로 변환
  const dataUrl = canvas.toDataURL("image/png");

  // 다운로드를 위한 링크 요소 생성 및 클릭
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log(`마스킹 파일 '${filename}' 다운로드 요청됨.`);
}
