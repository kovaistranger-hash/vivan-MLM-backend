/**
 * Picks the binary root user id used for auto-placement spillover search.
 * Today: returns the sponsor (no upline re-rooting). Extend later (e.g. weakest open leg in upline).
 */
export async function getBestSpilloverRootUserId(_c, sponsorUserId) {
    return sponsorUserId;
}
