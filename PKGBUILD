pkgname=dino-desktop
pkgver=1.0.0
pkgrel=1
pkgdesc="Multi-platform OpenSubsonic music player"
arch=('x86_64')
url="https://github.com/dinosoftware/dino-desktop"
license=('MIT')
depends=('gtk3' 'webkit2gtk-4.1' 'mpv')
makedepends=('go' 'npm' 'wails-cli')
source=("$pkgname-$pkgver.tar.gz::https://github.com/dinosoftware/dino-desktop/archive/v$pkgver.tar.gz")
sha256sums=('SKIP')

build() {
	cd "$srcdir/$pkgname-$pkgver"
	wails build
}

package() {
	cd "$srcdir/$pkgname-$pkgver"
	install -Dm755 build/bin/dino "$pkgdir/usr/bin/dino"
	install -Dm644 build/appicon.png "$pkgdir/usr/share/pixmaps/dino.png"
	install -Dm644 /dev/stdin "$pkgdir/usr/share/applications/dino.desktop" <<EOF
[Desktop Entry]
Name=Dino
Comment=OpenSubsonic music player
Exec=dino
Icon=dino
Type=Application
Categories=Audio;Music;Player;
StartupWMClass=Dino Desktop
EOF
}
