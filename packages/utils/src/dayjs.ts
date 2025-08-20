import _dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import 'dayjs/locale/ko'

_dayjs.locale('ko')
_dayjs.extend(utc)
_dayjs.extend(timezone)
_dayjs.tz.setDefault('Asia/Seoul')
_dayjs.extend(weekOfYear)

export function kdayjs(params?: any) {
  return _dayjs(params).tz('Asia/Seoul')
}

export const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토']
