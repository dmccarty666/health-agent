PID=$$; echo "Hello from bash worker PID $PID!" > /tmp/hw_$PID.txt; echo "{\"status\": \"done\", \"summary\": \"Created /tmp/hw_$PID.txt\"}"; ls /tmp/hw_*.txt 2>/dev/null
