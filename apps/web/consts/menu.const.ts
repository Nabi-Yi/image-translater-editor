import {
  Wallet,
  UserPlus,
  List,
  CircleMinus,
  CirclePlus,
  History,
  ArrowLeftRight,
  ArrowDownToLine,
  BookDown,
  BookUp,
  Asterisk,
  ArrowUpFromLine,
  Notebook,
  ArrowUp,
  ArrowDown,
  ArrowDownToDotIcon,
  ArrowDownToDot,
  ArrowUpFromDot,
  ArrowUpLeftFromCircle,
  ArrowDownRightFromCircle,
  ArrowDownLeftFromSquare,
  ArrowUpRightFromSquare,
  LucideChevronsLeftRight,
  ChevronsLeftRightEllipsis,
  ChevronRightCircle,
  ChevronRightSquare,
  LucideChevronRight,
  ArrowRightLeft,
  MoveRight,
  MoveLeft,
  BadgeDollarSign,
  QrCode,
  SquareAsterisk,
  User2,
} from "lucide-react";

const firstwalletaddress = "0xd43f084a24afa7a0e94515ef31f578e067377034";

export const menuItems = {
  docs: [
    {
      title: "입금 프로세스 개발하기",
      url: "/how-to-develop-deposit-process",
      icon: BookDown,
    },
    {
      title: "USDT/포인트 변환 프로세스 개발하기",
      url: "/how-to-develop-usdt-point-conversion-process",
      icon: ArrowRightLeft,
    },
    {
      title: "출금 프로세스 개발하기",
      url: "/how-to-develop-withdrawal-process",
      icon: BookUp,
    },
  ],
  api: [
    {
      title: "유저 지갑 획득",
      url: "/get-wallet",
      icon: UserPlus,
    },
    {
      title: "유저 지갑 조회",
      url: "/get-wallet-exist",
      icon: Wallet,
    },
    {
      title: "유저 지갑 리스트",
      url: "/get-wallet-list",
      icon: List,
    },
    {
      title: "환율 조회",
      url: "/get-exchange-rate",
      icon: BadgeDollarSign,
    },
    {
      title: "USDT -> 포인트 변환",
      url: "/convert-to-point",
      icon: MoveRight,
    },
    {
      title: "포인트 -> USDT 변환",
      url: "/convert-to-usdt",
      icon: MoveLeft,
    },
    {
      title: "출금 요청하기",
      url: "/request-withdrawal",
      icon: ArrowUpFromLine,
    },
    {
      title: "전체 입금 내역",
      url: "/get-admin-deposit-history",
      icon: ArrowDownToLine,
    },
    {
      title: "전체 출금 내역",
      url: "/get-admin-withdrawal-request-history",
      icon: ArrowUpFromLine,
    },
    {
      title: "유저별 출금 요청 내역",
      url: "/get-admin-withdrawal-request-history-by-user",
      icon: User2,
    },
    {
      title: "QR 코드 생성",
      url: "/get-address-qr",
      icon: QrCode,
    },
    {
      title: "액세스 토큰 생성",
      url: "/get-access-token",
      icon: SquareAsterisk,
    },
    // {
    //   title: "기본 출금 주소 설정하기(WIP)",
    //   url: "/set-withdrawal-address",
    //   icon: Notebook,
    // },
    {
      title: "유저 입금 내역(WIP)",
      url: "/get-user-deposit-history",
      icon: History,
    },
    {
      title: "유저 출금 요청 내역(WIP)",
      url: "/get-user-withdrawal-request-history",
      icon: History,
    },
    // {
    //   title: "USDT 입금",
    //   url: "/deposit",
    //   icon: Home,
    // },
    // {
    //   title: "입금자 명단",
    //   url: "/deposit-list",
    //   icon: Home,
    // },
    // {
    //   title: "출금 신청",
    //   url: "/withdrawal",
    //   icon: Inbox,
    // },
    // {
    //   title: "출금자 명단",
    //   url: "/withdrawal-list",
    //   icon: Inbox,
    // },
    // {
    // 	title: 'Calendar',
    // 	url: '#',
    // 	icon: Calendar,
    // },
    // {
    // 	title: 'Search',
    // 	url: '#',
    // 	icon: Search,
    // },
    // {
    // 	title: 'Settings',
    // 	url: '#',
    // 	icon: Settings,
    // },
  ],
  sdk: [],
  userViews: [
    {
      title: "유저 입금 화면 예시",
      url: `/user-deposit?network=eth&address=${firstwalletaddress}`,
      icon: ArrowDownLeftFromSquare,
    },
    {
      title: "유저 출금 요청 화면 예시",
      url: `/user-withdrawal-request?network=eth&address=${firstwalletaddress}`,
      icon: ArrowUpRightFromSquare,
    },
    {
      title: "유저 출금 요청 내역 예시",
      url: `/user-withdrawal-request-history?network=eth&address=${firstwalletaddress}`,
      icon: ArrowUpRightFromSquare,
    },
    {
      title: "유저 포인트 환전 화면 예시(WIP)",
      url: `/user-point-conversion?network=eth&address=${firstwalletaddress}`,
      icon: List,
    },
  ],
  adminViews: [
    {
      title: "유저 지갑 리스트",
      url: "/admin-wallet-list",
      icon: List,
    },
    {
      title: "전체 입금 내역",
      url: "/admin-deposit-history",
      icon: ArrowDownToLine,
    },
    {
      title: "전체 출금 내역",
      url: "/admin-withdrawal-request-history",
      icon: ArrowUpFromLine,
    },
    // {
    //   title: "루트 지갑(WIP)",
    //   url: "/admin-root-wallet",
    //   icon: Asterisk,
    // },
    {
      title: "USDT -> 포인트 전환(WIP)",
      url: "/admin-decrease-balance",
      icon: CircleMinus,
    },
    {
      title: "포인트 -> USDT 전환(WIP)",
      url: "/admin-increase-balance",
      icon: CirclePlus,
    },
    {
      title: "유저 입출금 내역(WIP)",
      url: "/admin-wallet-history",
      icon: History,
    },
  ],
};
