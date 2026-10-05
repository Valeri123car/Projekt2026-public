// Na Fly.io pridejo vse zahteve prek proxyja, zato je request.ip za vse enak.
// Pravi naslov odjemalca proxy zapiše v glavo Fly-Client-IP.
export function ipOdjemalca(request) {
  return request.headers["fly-client-ip"] || request.ip;
}
