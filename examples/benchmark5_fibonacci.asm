# Benchmark 5: Fibonacci Sequence Generator (F0 to F6)
# F[0]=0, F[1]=1, F[2]=1, F[3]=2, F[4]=3, F[5]=5, F[6]=8
ADDI $t0, $zero, 0
ADDI $t1, $zero, 1
ADDI $t2, $zero, 5
SW   $t0, 0($zero)
SW   $t1, 4($zero)
ADDI $s0, $zero, 8
fib_loop:
ADD  $t3, $t0, $t1
SW   $t3, 0($s0)
ADD  $t0, $zero, $t1
ADD  $t1, $zero, $t3
ADDI $s0, $s0, 4
ADDI $t2, $t2, -1
BNE  $t2, $zero, fib_loop
