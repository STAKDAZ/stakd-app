export type ShapeCatalogItem = {
  family: string;
  shape: string;
  description: string;
  lbsPerFoot: number;
  defaultGrade?: string;
  keywords?: string[];
};

function item(family: string, shape: string, lbsPerFoot: number, description = '', defaultGrade = 'A992'): ShapeCatalogItem {
  return { family, shape, lbsPerFoot, description: description || shape, defaultGrade };
}

export const shapeCatalog: ShapeCatalogItem[] = [
  item('Wide Flange', 'W8X10', 10), item('Wide Flange', 'W8X13', 13), item('Wide Flange', 'W8X18', 18), item('Wide Flange', 'W8X21', 21),
  item('Wide Flange', 'W10X12', 12), item('Wide Flange', 'W10X15', 15), item('Wide Flange', 'W10X19', 19), item('Wide Flange', 'W10X22', 22), item('Wide Flange', 'W10X26', 26), item('Wide Flange', 'W10X33', 33),
  item('Wide Flange', 'W12X14', 14), item('Wide Flange', 'W12X19', 19), item('Wide Flange', 'W12X22', 22), item('Wide Flange', 'W12X26', 26), item('Wide Flange', 'W12X35', 35), item('Wide Flange', 'W12X40', 40), item('Wide Flange', 'W12X50', 50),
  item('Wide Flange', 'W14X22', 22), item('Wide Flange', 'W14X26', 26), item('Wide Flange', 'W14X30', 30), item('Wide Flange', 'W14X38', 38), item('Wide Flange', 'W14X48', 48), item('Wide Flange', 'W14X61', 61), item('Wide Flange', 'W14X90', 90),
  item('Wide Flange', 'W16X26', 26), item('Wide Flange', 'W16X31', 31), item('Wide Flange', 'W16X36', 36), item('Wide Flange', 'W16X40', 40), item('Wide Flange', 'W16X50', 50), item('Wide Flange', 'W16X57', 57), item('Wide Flange', 'W16X67', 67),
  item('Wide Flange', 'W18X35', 35), item('Wide Flange', 'W18X40', 40), item('Wide Flange', 'W18X46', 46), item('Wide Flange', 'W18X50', 50), item('Wide Flange', 'W18X60', 60), item('Wide Flange', 'W18X71', 71),
  item('Wide Flange', 'W21X44', 44), item('Wide Flange', 'W21X50', 50), item('Wide Flange', 'W21X57', 57), item('Wide Flange', 'W21X68', 68), item('Wide Flange', 'W21X83', 83), item('Wide Flange', 'W21X93', 93),
  item('Wide Flange', 'W24X55', 55), item('Wide Flange', 'W24X62', 62), item('Wide Flange', 'W24X76', 76), item('Wide Flange', 'W24X84', 84), item('Wide Flange', 'W24X103', 103),
  item('Wide Flange', 'W27X84', 84), item('Wide Flange', 'W27X94', 94), item('Wide Flange', 'W27X102', 102), item('Wide Flange', 'W27X114', 114),
  item('Wide Flange', 'W30X90', 90), item('Wide Flange', 'W30X99', 99), item('Wide Flange', 'W30X108', 108), item('Wide Flange', 'W30X116', 116),

  item('Channel', 'C6X8.2', 8.2), item('Channel', 'C8X11.5', 11.5), item('Channel', 'C9X13.4', 13.4), item('Channel', 'C10X15.3', 15.3), item('Channel', 'C12X20.7', 20.7), item('Channel', 'C15X33.9', 33.9),
  item('MC Channel', 'MC8X8.5', 8.5), item('MC Channel', 'MC10X22', 22), item('MC Channel', 'MC12X14.3', 14.3), item('MC Channel', 'MC18X58', 58),

  item('Angle', 'L2X2X1/4', 3.19, 'Angle 2x2x1/4', 'A36'), item('Angle', 'L3X3X1/4', 5.72, 'Angle 3x3x1/4', 'A36'), item('Angle', 'L3X3X3/8', 8.41, 'Angle 3x3x3/8', 'A36'),
  item('Angle', 'L4X4X1/4', 7.58, 'Angle 4x4x1/4', 'A36'), item('Angle', 'L4X4X3/8', 11.1, 'Angle 4x4x3/8', 'A36'), item('Angle', 'L5X3-1/2X3/8', 12.2, 'Angle 5x3-1/2x3/8', 'A36'),
  item('Angle', 'L6X4X1/2', 19.1, 'Angle 6x4x1/2', 'A36'), item('Angle', 'L6X6X1/2', 28.2, 'Angle 6x6x1/2', 'A36'),

  item('HSS Square', 'HSS2X2X1/4', 5.79, 'Square tube 2x2x1/4', 'A500'), item('HSS Square', 'HSS3X3X1/4', 8.91, 'Square tube 3x3x1/4', 'A500'), item('HSS Square', 'HSS4X4X1/4', 12.2, 'Square tube 4x4x1/4', 'A500'),
  item('HSS Square', 'HSS4X4X3/8', 17.7, 'Square tube 4x4x3/8', 'A500'), item('HSS Square', 'HSS6X6X1/4', 18.7, 'Square tube 6x6x1/4', 'A500'), item('HSS Square', 'HSS8X8X3/8', 39.3, 'Square tube 8x8x3/8', 'A500'),

  item('HSS Rectangular', 'HSS4X2X1/4', 8.07, 'Rectangular tube 4x2x1/4', 'A500'), item('HSS Rectangular', 'HSS6X4X1/4', 13.4, 'Rectangular tube 6x4x1/4', 'A500'), item('HSS Rectangular', 'HSS8X4X1/4', 17.1, 'Rectangular tube 8x4x1/4', 'A500'),
  item('HSS Rectangular', 'HSS8X6X3/8', 28.6, 'Rectangular tube 8x6x3/8', 'A500'), item('HSS Rectangular', 'HSS10X6X1/2', 38.8, 'Rectangular tube 10x6x1/2', 'A500'),

  item('Pipe', 'PIPE2 STD', 3.66, 'Pipe 2 STD', 'A53'), item('Pipe', 'PIPE3 STD', 7.58, 'Pipe 3 STD', 'A53'), item('Pipe', 'PIPE4 STD', 10.79, 'Pipe 4 STD', 'A53'), item('Pipe', 'PIPE6 STD', 18.97, 'Pipe 6 STD', 'A53'), item('Pipe', 'PIPE8 STD', 28.55, 'Pipe 8 STD', 'A53'),

  item('Plate', 'PL1/4', 10.21, 'Plate 1/4 x 12', 'A36'), item('Plate', 'PL3/8', 15.32, 'Plate 3/8 x 12', 'A36'), item('Plate', 'PL1/2', 20.43, 'Plate 1/2 x 12', 'A36'), item('Plate', 'PL3/4', 30.64, 'Plate 3/4 x 12', 'A36'), item('Plate', 'PL1', 40.86, 'Plate 1 x 12', 'A36'),

  item('Flat Bar', 'FB2X1/4', 1.70, 'Flat bar 2 x 1/4', 'A36'), item('Flat Bar', 'FB3X3/8', 3.83, 'Flat bar 3 x 3/8', 'A36'), item('Flat Bar', 'FB4X1/2', 6.81, 'Flat bar 4 x 1/2', 'A36'), item('Flat Bar', 'FB6X1/2', 10.21, 'Flat bar 6 x 1/2', 'A36'),

  item('Round Bar', 'RB1', 2.67, 'Round bar 1', 'A36'), item('Round Bar', 'RB1-1/2', 6.01, 'Round bar 1-1/2', 'A36'), item('Round Bar', 'RB2', 10.68, 'Round bar 2', 'A36'),
];

export const shapeFamilies = Array.from(new Set(shapeCatalog.map((row) => row.family)));
