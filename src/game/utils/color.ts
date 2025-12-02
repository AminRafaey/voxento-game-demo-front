import Phaser from "phaser";

export function tintToColorString(tint: number): string {
  const color = Phaser.Display.Color.IntegerToColor(tint);
  return Phaser.Display.Color.RGBToString(
    color.red,
    color.green,
    color.blue,
    0,
    "#"
  );
}
