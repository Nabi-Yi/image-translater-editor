//object나 배열 내부의 Bigint들을 toString으로.
//재귀함수기 때문에 너무 크거나 내부로 많이 들어가는 data는 쓰지 않기를 추천함.(성능에 크게 영향 갈 수 있음)

export function parseBigintJson(input: any): any {
  if (Array.isArray(input)) {
    return input.map(parseBigintJson);
  } else if (typeof input === "object" && input !== null) {
    if (input instanceof Date) {
      return input.toISOString(); // Date 객체를 ISO 8601 형식의 문자열로 변환
    }
    const convertedObj = { ...input };

    Object.entries(convertedObj).forEach(([key, value]) => {
      if (
        Array.isArray(value) ||
        (typeof value === "object" && value !== null)
      ) {
        convertedObj[key] = parseBigintJson(value);
      } else if (typeof value === "bigint") {
        convertedObj[key] = value.toString();
      }
    });

    return convertedObj;
  }

  return input;
}
