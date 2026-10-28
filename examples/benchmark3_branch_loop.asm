# Benchmark 3: Loop Counter with BEQ Branch
# Computes the sum of numbers from 1 to 5: 1 + 2 + 3 + 4 + 5 = 15
ADDI $s0, $zero, 5
ADDI $t0, $zero, 1
ADDI $t1, $zero, 0
loop:
ADD  $t1, $t1, $t0
BEQ  $t0, $s0, done
ADDI $t0, $t0, 1
J    loop
done:
SW   $t1, 16($zero)
