# Benchmark 2: Load-Use Data Hazard & 1-Cycle Stall Bubble
# LW followed immediately by dependent ADD requires 1 stall bubble even with forwarding!
ADDI $s0, $zero, 42
SW   $s0, 8($zero)
LW   $t1, 8($zero)
ADD  $t2, $t1, $s0
ADDI $t3, $t2, 5
