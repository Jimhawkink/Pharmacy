// =====================================================================
// ALPHA PHARMACY - BULK BREAKDOWN & AUTOMATIC BOX BREAKING ENGINE
// Automatically manages Big Units (Boxes/Packs) & Small Units (Pieces/Tabs)
// =====================================================================

export interface StockBreakdown {
    totalPieces: number;
    packSize: number;
    boxes: number;
    loosePieces: number;
    purchaseUnit: string;
    salesUnit: string;
    displayText: string;
    badgeText: string;
    shortBadge: string;
    isBoxBroken: boolean;
}

/**
 * Calculates pharmaceutical stock breakdown with automatic box breaking.
 * 
 * Example: 5 boxes of 100 pieces (Total: 500 pieces)
 * - 1 box is automatically opened for dispensing:
 *   -> 4 unbroken Boxes + 100 loose Pieces
 * - Customer buys 10 pieces (490 left):
 *   -> 4 unbroken Boxes + 90 loose Pieces
 * - Customer buys 90 more pieces (400 left - 1 full box finished):
 *   -> Next box automatically broken -> 3 unbroken Boxes + 100 loose Pieces
 * - Down to 50 pieces left:
 *   -> 0 unbroken Boxes + 50 loose Pieces
 * - 0 pieces left:
 *   -> Out of Stock
 */
export function calculateStockBreakdown(
    totalPieces: number,
    packSize: number = 1,
    purchaseUnit: string = 'Box',
    salesUnit: string = 'Piece'
): StockBreakdown {
    const total = Math.max(0, Number(totalPieces) || 0);
    const ppp = Math.max(1, Number(packSize) || 1);
    const pUnit = (purchaseUnit || 'Box').trim();
    const sUnit = (salesUnit || 'Piece').trim();

    // Out of Stock
    if (total === 0) {
        return {
            totalPieces: 0,
            packSize: ppp,
            boxes: 0,
            loosePieces: 0,
            purchaseUnit: pUnit,
            salesUnit: sUnit,
            displayText: 'Out of Stock',
            badgeText: '0 Pcs',
            shortBadge: 'Out',
            isBoxBroken: false,
        };
    }

    // Single unit products (pack size 1 - liquids, ointments, single items)
    if (ppp <= 1) {
        const unitPlural = total === 1 ? sUnit : `${sUnit}s`;
        return {
            totalPieces: total,
            packSize: 1,
            boxes: 0,
            loosePieces: total,
            purchaseUnit: pUnit,
            salesUnit: sUnit,
            displayText: `${total.toLocaleString()} ${unitPlural}`,
            badgeText: `${total.toLocaleString()} ${sUnit}`,
            shortBadge: `${total} ${sUnit}`,
            isBoxBroken: false,
        };
    }

    // Automatic Box Breaking Formula:
    // Open box has: ((total - 1) % ppp) + 1 pieces
    // Unbroken sealed boxes: Math.floor((total - 1) / ppp)
    const loosePieces = ((total - 1) % ppp) + 1;
    const boxes = Math.floor((total - 1) / ppp);

    const boxLabel = boxes === 1 ? pUnit : `${pUnit}es`;
    const pieceLabel = loosePieces === 1 ? sUnit : `${sUnit}s`;

    let displayText = '';
    let badgeText = '';
    let shortBadge = '';

    if (boxes > 0) {
        displayText = `${boxes} ${boxLabel} & ${loosePieces} ${pieceLabel}`;
        badgeText = `${boxes} ${pUnit} + ${loosePieces} ${sUnit} (${total} total)`;
        shortBadge = `${boxes}B + ${loosePieces}P`;
    } else {
        displayText = `${loosePieces} ${pieceLabel}`;
        badgeText = `${loosePieces} ${sUnit}`;
        shortBadge = `${loosePieces} ${sUnit}`;
    }

    return {
        totalPieces: total,
        packSize: ppp,
        boxes,
        loosePieces,
        purchaseUnit: pUnit,
        salesUnit: sUnit,
        displayText,
        badgeText,
        shortBadge,
        isBoxBroken: boxes > 0 && loosePieces < ppp,
    };
}
