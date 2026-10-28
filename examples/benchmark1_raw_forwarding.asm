# Benchmark 1: RAW Data Dependencies & Forwarding
# Demonstrates EX->EX and MEM->EX hardware forwarding bypassing stalls
ADDI $t0, $zero, 10
ADDI $t1, $zero, 20
ADD  $t2, $t0, $t1
SUB  $t3, $t2, $t0
AND  $t4, $t3, $t1
SW   $t4, 0($zero)
