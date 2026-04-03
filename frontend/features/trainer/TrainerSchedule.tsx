import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  SafeAreaView,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

// Tipuri de date
interface Client {
  id: string;
  name: string;
}

interface Slot {
  id: string;
  time: string;
  client: Client | null;
}

// Date Dummy
const INITIAL_CLIENTS: Client[] = [
  { id: 'c1', name: 'Alex Popescu' },
  { id: 'c2', name: 'Maria Ionescu' },
  { id: 'c3', name: 'Ionut Vasile' },
];

const INITIAL_SLOTS: Slot[] = [
  { id: 's1', time: '09:00 - 10:00', client: null },
  { id: 's2', time: '10:00 - 11:00', client: null },
  { id: 's3', time: '11:00 - 12:00', client: null },
];

// Componenta pentru un client care poate fi "tras" (Draggable)
const DraggableClient = ({ client, onDrop }: { client: Client; onDrop: (client: Client, x: number, y: number) => void }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false, // obligatoriu false pentru Layout/PanResponder
      }),
      onPanResponderRelease: (e, gesture) => {
        // gesture.moveX si gesture.moveY ne dau coordonatele globale de pe ecran
        onDrop(client, gesture.moveX, gesture.moveY);
        
        // Resetăm poziția cardului la locul inițial cu o animație fluidă
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[pan.getLayout(), styles.clientCard]}
    >
      <Text style={styles.clientText}>👤 {client.name}</Text>
    </Animated.View>
  );
};

export default function TrainerScheduleScreen() {
  const [unassignedClients, setUnassignedClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [slots, setSlots] = useState<Slot[]>(INITIAL_SLOTS);
  const [slotLayouts, setSlotLayouts] = useState<{ [key: string]: any }>({});

  // Funcția care verifică dacă clientul a picat pe vreun slot liber
  const handleDrop = (client: Client, dropX: number, dropY: number) => {
    let assignedSlotId: string | null = null;

    Object.keys(slotLayouts).forEach((slotId) => {
      const layout = slotLayouts[slotId];
      // Verificăm dacă coordonatele de drop se află în interiorul "dreptunghiului" slotului
      if (
        dropX >= layout.x &&
        dropX <= layout.x + layout.width &&
        dropY >= layout.y &&
        dropY <= layout.y + layout.height
      ) {
        assignedSlotId = slotId;
      }
    });

    if (assignedSlotId) {
      setSlots((prev) =>
        prev.map((s) => {
          // Asignăm clientul pe slot doar dacă nu era deja ocupat (opțional: poți permite suprascrierea)
          if (s.id === assignedSlotId && !s.client) {
            return { ...s, client: client };
          }
          return s;
        })
      );
      // Scoatem clientul din lista de neasignați
      setUnassignedClients((prev) => prev.filter((c) => c.id !== client.id));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📅 Open Day Schedule</Text>

      <View style={styles.content}>
        {/* Zona 1: Lista clienților */}
        <View style={styles.clientsSection}>
          <Text style={styles.sectionTitle}>Clienți Neasignați</Text>
          {unassignedClients.map((client) => (
            <DraggableClient key={client.id} client={client} onDrop={handleDrop} />
          ))}
          {unassignedClients.length === 0 && (
            <Text style={styles.emptyText}>Toți clienții au fost asignați! 🎉</Text>
          )}
        </View>

        {/* Zona 2: Sloturile orare (Drop Zones) */}
        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>Sloturi Orare</Text>
          {slots.map((slot) => (
            <View
              key={slot.id}
              style={[styles.slot, slot.client ? styles.slotOccupied : null]}
              // Salvăm coordonatele globale ale fiecărui slot în momentul randării
              onLayout={(e) => {
                // Folosim un mic delay sau setTimeout pt a fi siguri ca elementul exista pe ecran inainte sa-i luam coordonatele absolute
                setTimeout(() => {
                   // target.measure ia coordonatele absolute relativ cu fereastra (Window)
                   e.target.measure((x, y, width, height, pageX, pageY) => {
                    setSlotLayouts((prev) => ({
                      ...prev,
                      [slot.id]: { x: pageX, y: pageY, width, height },
                    }));
                  });
                }, 0);
              }}
            >
              <Text style={styles.slotTime}>{slot.time}</Text>
              {slot.client ? (
                <View style={styles.assignedClient}>
                  <Text style={styles.assignedClientText}>✅ {slot.client.name}</Text>
                </View>
              ) : (
                <Text style={styles.slotEmptyText}>Trage un client aici...</Text>
              )}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
    color: '#1F2937',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    gap: 10,
  },
  clientsSection: {
    flex: 0.4, // ocupă 40% din ecran
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scheduleSection: {
    flex: 0.6, // ocupă 60% din ecran
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#4B5563',
    textAlign: 'center',
  },
  clientCard: {
    backgroundColor: '#6366F1',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    zIndex: 100, // Important pentru a fi deasupra celorlalte elemente in timp ce este tras
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  clientText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  slot: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    minHeight: 80,
    justifyContent: 'center',
  },
  slotOccupied: {
    borderColor: '#10B981', // Verde daca e ocupat
    backgroundColor: '#ECFDF5',
    borderStyle: 'solid',
  },
  slotTime: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  slotEmptyText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  assignedClient: {
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  assignedClientText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});