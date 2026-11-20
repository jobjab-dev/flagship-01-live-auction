export interface BidEntry {
  id: string;
  bidder: string;
  paddle: string;
  channel: "FLOOR" | "TELEPHONE" | "ONLINE" | "YOU";
  amount: number;
  timestamp: number;
  pending?: boolean;
}

export interface AuctionLot {
  id: string;
  lotNumber: string;
  title: string;
  maker: string;
  year: string;
  origin: string;
  condition: string;
  estimateLow: number;
  estimateHigh: number;
  openingBid: number;
  reservePrice: number;
  incrementSteps: [number, number, number];
  durationMs: number;
  image: string;
  imageAlt: string;
  provenance: string;
  specs: { label: string; value: string }[];
  initialBids: BidEntry[];
}

export const RIVAL_BIDDERS: Array<{
  bidder: string;
  paddle: string;
  channel: "FLOOR" | "TELEPHONE" | "ONLINE";
}> = [
  { bidder: "Geneva Collector", paddle: "#418", channel: "TELEPHONE" },
  { bidder: "Tokyo Private Room", paddle: "#209", channel: "ONLINE" },
  { bidder: "Zurich Saleroom Seat 14", paddle: "#014", channel: "FLOOR" },
  { bidder: "Basel Archive Desk", paddle: "#312", channel: "ONLINE" },
  { bidder: "Milan Industrial Trust", paddle: "#506", channel: "TELEPHONE" },
  { bidder: "London Horology Syndicate", paddle: "#119", channel: "ONLINE" },
];

export const INITIAL_LOTS: AuctionLot[] = [
  {
    id: "lot-01",
    lotNumber: "LOT 01",
    title: "Ref. 3418 Split-Seconds Rattrapante Chronograph",
    maker: "Atelier Lemania-Vacheron Workshop",
    year: "1968",
    origin: "Geneva / Vallée de Joux",
    condition: "Unpolished Steel · Original Cream Dial",
    estimateLow: 28000,
    estimateHigh: 42000,
    openingBid: 24500,
    reservePrice: 24000,
    incrementSteps: [250, 500, 1000],
    durationMs: 42_000,
    image: "/images/lot-01-chronograph.jpg",
    imageAlt:
      "1968 stainless steel split-seconds chronograph wristwatch on a travertine plinth",
    provenance:
      "Commissioned in 1968 for an alpine rally timing steward in Lucerne. Retains original column-wheel split mechanism, crown pusher coaxial action, and archival Geneva extract.",
    specs: [
      { label: "Caliber", value: "Manual 13-ligne Rattrapante" },
      { label: "Case Diameter", value: "37.5 mm Brushed Steel" },
      { label: "Strap", value: "Forest Alpine Calfskin" },
      { label: "Archive", value: "Extract No. HR-68-402" },
    ],
    initialBids: [
      {
        id: "seed-1-3",
        bidder: "Geneva Collector",
        paddle: "#418",
        channel: "TELEPHONE",
        amount: 24500,
        timestamp: -14000,
      },
      {
        id: "seed-1-2",
        bidder: "Zurich Saleroom Seat 14",
        paddle: "#014",
        channel: "FLOOR",
        amount: 23750,
        timestamp: -38000,
      },
      {
        id: "seed-1-1",
        bidder: "Basel Archive Desk",
        paddle: "#312",
        channel: "ONLINE",
        amount: 23000,
        timestamp: -64000,
      },
    ],
  },
  {
    id: "lot-02",
    lotNumber: "LOT 02",
    title: "Studio Reference Model P-402 Belt-Drive Turntable",
    maker: "Thorens / Braun Prototype Division",
    year: "1974",
    origin: "Lahr / Frankfurt",
    condition: "Restored Plinth · Factory Strobe Calibrated",
    estimateLow: 11000,
    estimateHigh: 16500,
    openingBid: 9800,
    reservePrice: 9500,
    incrementSteps: [200, 400, 800],
    durationMs: 58_000,
    image: "/images/lot-02-turntable.jpg",
    imageAlt:
      "Minimalist brushed anodized aluminum reference turntable with smoked dust cover",
    provenance:
      "Single-owner broadcast listening room piece milled from solid bead-blasted aluminum billet with isolated spring sub-chassis and original low-mass magnesium tonearm.",
    specs: [
      { label: "Drive System", value: "24-Pole Synchronous Belt" },
      { label: "Platter Mass", value: "4.2 kg Machined Zinc" },
      { label: "Speeds", value: "33.3 / 45 RPM Quartz Lock" },
      { label: "Serial", value: "Unit 019 / 050" },
    ],
    initialBids: [
      {
        id: "seed-2-2",
        bidder: "Tokyo Private Room",
        paddle: "#209",
        channel: "ONLINE",
        amount: 9800,
        timestamp: -19000,
      },
      {
        id: "seed-2-1",
        bidder: "Milan Industrial Trust",
        paddle: "#506",
        channel: "TELEPHONE",
        amount: 9200,
        timestamp: -51000,
      },
    ],
  },
  {
    id: "lot-03",
    lotNumber: "LOT 03",
    title: "Counterbalanced Brass & Opal Drafting Luminaires",
    maker: "BAG Turgi Studio Edition",
    year: "1962",
    origin: "Turgi, Aargau",
    condition: "Original Patina · Rewired Silk Cord",
    estimateLow: 6500,
    estimateHigh: 9800,
    openingBid: 5400,
    reservePrice: 5200,
    incrementSteps: [150, 300, 600],
    durationMs: 65_000,
    image: "/images/lot-03-lamp.jpg",
    imageAlt:
      "Counterbalanced brass and opal glass drafting lamp on travertine block",
    provenance:
      "Acquired from an architectural practice on Bahnhofstrasse. Features cast brass counterweight sphere, friction swivel elbow, and hand-blown cased opal diffuser.",
    specs: [
      { label: "Materials", value: "Unlacquered Brass & Opal Glass" },
      { label: "Reach", value: "680 mm Articulated Arm" },
      { label: "Diffuser", value: "240 mm Triplex Glass" },
      { label: "Stamp", value: "BAG TURGI 62-B" },
    ],
    initialBids: [
      {
        id: "seed-3-2",
        bidder: "Milan Industrial Trust",
        paddle: "#506",
        channel: "TELEPHONE",
        amount: 5400,
        timestamp: -22000,
      },
      {
        id: "seed-3-1",
        bidder: "Zurich Saleroom Seat 14",
        paddle: "#014",
        channel: "FLOOR",
        amount: 5100,
        timestamp: -47000,
      },
    ],
  },
  {
    id: "lot-04",
    lotNumber: "LOT 04",
    title: "P2 Optical Bench 4×5 Technical Monorail Camera",
    maker: "Sinar Precision Optical Works",
    year: "1981",
    origin: "Schaffhausen",
    condition: "Mint Bellows · Rodenstock 150mm Included",
    estimateLow: 8200,
    estimateHigh: 12000,
    openingBid: 7200,
    reservePrice: 7000,
    incrementSteps: [200, 400, 750],
    durationMs: 74_000,
    image: "/images/lot-04-camera.jpg",
    imageAlt:
      "Matte black anodized medium-format technical field camera with leather bellows",
    provenance:
      "Maintained in the archive of a Zurich industrial photography studio. Asymmetric tilt/swing micrometer gearing remains factory tight with zero light leaks.",
    specs: [
      { label: "Format", value: "4×5 in / 6×9 Roll Back" },
      { label: "Optics", value: "Apo-Sironar-S 150mm f/5.6" },
      { label: "Movements", value: "Geared Yaw-Free Micrometer" },
      { label: "Case", value: "Fitted Aluminum Trunk" },
    ],
    initialBids: [
      {
        id: "seed-4-2",
        bidder: "London Horology Syndicate",
        paddle: "#119",
        channel: "ONLINE",
        amount: 7200,
        timestamp: -28000,
      },
      {
        id: "seed-4-1",
        bidder: "Basel Archive Desk",
        paddle: "#312",
        channel: "ONLINE",
        amount: 6800,
        timestamp: -61000,
      },
    ],
  },
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(amount);
}
