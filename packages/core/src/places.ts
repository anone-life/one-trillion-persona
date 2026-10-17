// 出生地 → 时区。排八字只需要时区（夏令时一律去掉，见 spec/bazi-rules.v1.md §1），所以表里只放时区，不放经度。
// 找不到自己城市的，选同一个时区的城市，排出来一样。

export interface Place { id: string; label: string; country: string; tz: string }

const P = (id: string, label: string, country: string, tz: string): Place => ({ id, label, country, tz });

export const BIRTHPLACES: Place[] = [
  // East Asia
  P("tokyo", "Tokyo", "Japan", "Asia/Tokyo"), P("osaka", "Osaka", "Japan", "Asia/Tokyo"), P("kyoto", "Kyoto", "Japan", "Asia/Tokyo"),
  P("sapporo", "Sapporo", "Japan", "Asia/Tokyo"), P("fukuoka", "Fukuoka", "Japan", "Asia/Tokyo"),
  P("seoul", "Seoul", "South Korea", "Asia/Seoul"), P("busan", "Busan", "South Korea", "Asia/Seoul"),
  P("beijing", "Beijing", "China", "Asia/Shanghai"), P("shanghai", "Shanghai", "China", "Asia/Shanghai"),
  P("guangzhou", "Guangzhou", "China", "Asia/Shanghai"), P("shenzhen", "Shenzhen", "China", "Asia/Shanghai"),
  P("chengdu", "Chengdu", "China", "Asia/Shanghai"), P("harbin", "Harbin", "China", "Asia/Shanghai"),
  P("urumqi", "Ürümqi", "China", "Asia/Shanghai"),
  P("hongkong", "Hong Kong", "China", "Asia/Hong_Kong"), P("macau", "Macau", "China", "Asia/Macau"),
  P("taipei", "Taipei", "Taiwan", "Asia/Taipei"), P("kaohsiung", "Kaohsiung", "Taiwan", "Asia/Taipei"),
  P("ulaanbaatar", "Ulaanbaatar", "Mongolia", "Asia/Ulaanbaatar"),
  // Southeast & South Asia
  P("singapore", "Singapore", "Singapore", "Asia/Singapore"), P("kualalumpur", "Kuala Lumpur", "Malaysia", "Asia/Kuala_Lumpur"),
  P("bangkok", "Bangkok", "Thailand", "Asia/Bangkok"), P("hochiminh", "Ho Chi Minh City", "Vietnam", "Asia/Ho_Chi_Minh"),
  P("hanoi", "Hanoi", "Vietnam", "Asia/Bangkok"), P("manila", "Manila", "Philippines", "Asia/Manila"),
  P("jakarta", "Jakarta", "Indonesia", "Asia/Jakarta"), P("mumbai", "Mumbai", "India", "Asia/Kolkata"),
  P("delhi", "Delhi", "India", "Asia/Kolkata"), P("karachi", "Karachi", "Pakistan", "Asia/Karachi"),
  P("dhaka", "Dhaka", "Bangladesh", "Asia/Dhaka"),
  // Oceania
  P("sydney", "Sydney", "Australia", "Australia/Sydney"), P("melbourne", "Melbourne", "Australia", "Australia/Melbourne"),
  P("perth", "Perth", "Australia", "Australia/Perth"), P("auckland", "Auckland", "New Zealand", "Pacific/Auckland"),
  // Middle East & Africa
  P("dubai", "Dubai", "United Arab Emirates", "Asia/Dubai"), P("tehran", "Tehran", "Iran", "Asia/Tehran"),
  P("istanbul", "Istanbul", "Türkiye", "Europe/Istanbul"), P("telaviv", "Tel Aviv", "Israel", "Asia/Jerusalem"),
  P("cairo", "Cairo", "Egypt", "Africa/Cairo"), P("lagos", "Lagos", "Nigeria", "Africa/Lagos"),
  P("nairobi", "Nairobi", "Kenya", "Africa/Nairobi"), P("johannesburg", "Johannesburg", "South Africa", "Africa/Johannesburg"),
  // Europe
  P("london", "London", "United Kingdom", "Europe/London"), P("dublin", "Dublin", "Ireland", "Europe/Dublin"),
  P("lisbon", "Lisbon", "Portugal", "Europe/Lisbon"), P("paris", "Paris", "France", "Europe/Paris"),
  P("madrid", "Madrid", "Spain", "Europe/Madrid"), P("barcelona", "Barcelona", "Spain", "Europe/Madrid"),
  P("rome", "Rome", "Italy", "Europe/Rome"), P("milan", "Milan", "Italy", "Europe/Rome"),
  P("berlin", "Berlin", "Germany", "Europe/Berlin"), P("munich", "Munich", "Germany", "Europe/Berlin"),
  P("amsterdam", "Amsterdam", "Netherlands", "Europe/Amsterdam"), P("brussels", "Brussels", "Belgium", "Europe/Brussels"),
  P("zurich", "Zurich", "Switzerland", "Europe/Zurich"), P("vienna", "Vienna", "Austria", "Europe/Vienna"),
  P("prague", "Prague", "Czechia", "Europe/Prague"), P("warsaw", "Warsaw", "Poland", "Europe/Warsaw"),
  P("stockholm", "Stockholm", "Sweden", "Europe/Stockholm"), P("oslo", "Oslo", "Norway", "Europe/Oslo"),
  P("copenhagen", "Copenhagen", "Denmark", "Europe/Copenhagen"), P("helsinki", "Helsinki", "Finland", "Europe/Helsinki"),
  P("athens", "Athens", "Greece", "Europe/Athens"), P("kyiv", "Kyiv", "Ukraine", "Europe/Kyiv"),
  P("moscow", "Moscow", "Russia", "Europe/Moscow"),
  // Americas
  P("newyork", "New York", "United States", "America/New_York"), P("boston", "Boston", "United States", "America/New_York"),
  P("miami", "Miami", "United States", "America/New_York"), P("chicago", "Chicago", "United States", "America/Chicago"),
  P("houston", "Houston", "United States", "America/Chicago"), P("denver", "Denver", "United States", "America/Denver"),
  P("phoenix", "Phoenix", "United States", "America/Phoenix"), P("losangeles", "Los Angeles", "United States", "America/Los_Angeles"),
  P("sanfrancisco", "San Francisco", "United States", "America/Los_Angeles"), P("seattle", "Seattle", "United States", "America/Los_Angeles"),
  P("honolulu", "Honolulu", "United States", "Pacific/Honolulu"), P("anchorage", "Anchorage", "United States", "America/Anchorage"),
  P("toronto", "Toronto", "Canada", "America/Toronto"), P("montreal", "Montreal", "Canada", "America/Toronto"),
  P("vancouver", "Vancouver", "Canada", "America/Vancouver"), P("mexicocity", "Mexico City", "Mexico", "America/Mexico_City"),
  P("havana", "Havana", "Cuba", "America/Havana"), P("bogota", "Bogotá", "Colombia", "America/Bogota"),
  P("lima", "Lima", "Peru", "America/Lima"), P("santiago", "Santiago", "Chile", "America/Santiago"),
  P("buenosaires", "Buenos Aires", "Argentina", "America/Argentina/Buenos_Aires"), P("saopaulo", "São Paulo", "Brazil", "America/Sao_Paulo"),
  P("riodejaneiro", "Rio de Janeiro", "Brazil", "America/Sao_Paulo"),
];

export function placeById(id: string): Place | undefined {
  return BIRTHPLACES.find((p) => p.id === id);
}
