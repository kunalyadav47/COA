# Benchmark 4: Structural Memory Hazard (Von Neumann Mode)
# Forces concurrent IF (fetch) and MEM (store/load) access to demonstrate unified memory arbitration
ADDI $s1, $zero, 100
SW   $s1, 0($zero)
LW   $s2, 0($zero)
ADD  $s3, $s1, $s2
ADDI $s4, $s3, 50
